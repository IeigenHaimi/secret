<template>
  <div class="recharge-page">
    <div class="recharge-toL2-tip flex">
      <div><i class="info_icon"></i></div>
      <div class="flex flex-column">
        <p>Deposit to L2</p>
        <div class="expand">
          <span class="expand-tip">{{ RECHAERGE_TIP }}</span>
        </div>
      </div>
    </div>
    <div class="recharge-opt-area">
      <van-tabs v-model="activeName">
        <van-tab title="Deposit From L1" name="fromL1">
          <v-tokenAmount
            key="tokenAmount-recharge"
            type="recharge"
            @childEvent="submitRecharge" />
        </van-tab>
        <van-tab title="Deposit From L2" name="fromL2">
          <div class="recharge-amount-wrap">
            <div class="flex flex-center">
              <div class="img-QR" v-if="defaultAddress!=='' && !walletIsLock">
                <div ref="qrCodeUrl"></div>
              </div>
              <div v-else style="width: 100%">
                <v-unlockwallet key="unlockWalletButton" />
              </div>
            </div>
            <div class="recharge-address-wrapper" v-if="!walletIsLock">
              <h3>Deposit Address</h3>
              <div class="address">{{ defaultAddress }}</div>
              <van-button color="#ECEEF8" class="copy-address" @click="copyAddress">
                <span slots="default" style="color:#495ABE">Copy Address</span>
              </van-button>
              <span>
                <span>EigenSecret supported assets only.</span>
                <span>Do not send other assets to this address.</span>
              </span>
            </div>
          </div>
        </van-tab>
      </van-tabs>
    </div>
    <v-exchangeList key="comon-exchangeList" type="L1ToL2" v-show="activeName=='fromL1'&&!walletIsLock" />
    <van-popup v-model="show" round :close-on-click-overlay="false" class="waiting-modal flex flex-center flex-column">
      <div class="inner-wrapper">
        <i class="confirm_icon"></i>
        <span class="tip">{{ tipTxt }}</span>
      </div>
    </van-popup>
    <v-statusPop
      :status="popStatus"
      :title="statusPopTitle"
      :timeTxt="timeTxt"
      tip=""
      :show="showStatusPop"
      @childEvent="changeVisible" />
    <van-popup v-model="showRefresh" class="status-popUp-refresh flex flex-center flex-column">
      <i class="icon icon-failed"></i>
      <span class="main-txt">No Transactions</span>
      <span class="supplement-txt">Refresh to get histoty</span>
      <van-button block color="#495ABF" class="button" @click="retryAddHistory">{{ refreshing?"Refresh...":"Refresh"}}</van-button>
    </van-popup>
    <v-netTipPopup :show="showNetTip" key="netTipModal" showType="l1"/>
  </div>
</template>
<script>
import Vue from 'vue';
import _ from 'lodash';
import { RECHAERGE_TIP } from '@/utils/global';
import ExchangeList from '@/components/ExchangeList';
import TokenAmount from '@/components/TokenAmount';
import StatusPop from '@/components/StatusPop';
import NetTipModal from '@/components/NetTipModal';
import UnlockWallet from '@/components/UnlockWallet';
import { wait, prettyLog } from '@/utils/index'
import { Tab, Tabs, Button, Col, Row, Toast, Popup, CountDown, Dialog } from 'vant';
import { getNetMode, getSelectedChainID, initBrideByTransanctionType } from '@/utils/web3'
import { utils, ethers } from 'ethers'
import { DEFAULTIMG } from '@/utils/global';
import { NETWORKS } from '@/utils/netWork'
import { Bridge } from 'arb-ts';
import { TRANSACTION_TYPE } from '@/api/transaction';
import { copyTxt } from '@/utils/index';
import QRCode from 'qrcodejs2'
import { utils as web3utils } from 'web3';

const { parseEther } = utils;


Vue.use(Tab);
Vue.use(Tabs);
Vue.use(Button);
Vue.use(Col);
Vue.use(Row);
Vue.use(Toast);
Vue.use(Popup);
Vue.use(CountDown);
Vue.use(Dialog);

export default {
  name: "Recharge",
  components: {
    'v-exchangeList': ExchangeList,
    'v-tokenAmount': TokenAmount,
    'v-statusPop': StatusPop,
    "v-netTipPopup": NetTipModal,
    "v-unlockwallet": UnlockWallet,
  },
  data() {
    return {
      DEFAULTIMG,
      RECHAERGE_TIP,
      activeName: 'fromL1', // fromL1 | fromL2
      show: false,
      tipTxt: 'Confirm On The Wallet',
      showStatusPop: false,
      popStatus: "success",
      statusPopTitle: 'Transfer Submitted',
      // timeTxt: 'It is expected to take effect within 1 minute',
      // tip: 'You can check the transaction details in the transaction record',
      timeTxt: 'Will take effect in one minute',
      showNetTip: false,
      bridge: null,
      addHistoryData: null,
      showRefresh: false,
      refreshing: false,
    }
  },
  watch: {
    activeName(newValue, oldValue) {
      if (newValue === 'fromL2') {
        window.setTimeout(()=>{
          this.creatQrCode();
        },0)
      }
    },
    '$store.state.metamask.walletIsLock': function (res) {
      if (!this.walletIsLock) {
        window.setTimeout(()=>{
          this.creatQrCode();
        },800)
      }
    }
  },
  computed: {
    walletIsLock() {
      return this.$store.state.metamask.walletIsLock;
    },
    metamaskInstall() {
      return this.$store.state.metamask.metamaskInstall;
    },
    defaultAddress() {
      return this.$store.state.metamask.accountsArr[0] || '';
    },
  },
  methods: {
    copyAddress() {
      if (this.walletIsLock) {
        return;
      }
      copyTxt(this.defaultAddress)
      Toast.success('Success')
    },
    async getWalletBalance() {
      const testWalletL1EthBalance = await testBridge.getAndUpdateL1EthBalance()
      const testWalletL2EthBalance = await testBridge.getAndUpdateL2EthBalance()
      console.log(testWalletL1EthBalance.toString(), testWalletL2EthBalance.toString())
    },
    initBridge() {
      const connectAddress = window.ethereum.selectedAddress;
      const metamaskProvider = new ethers.providers.Web3Provider(window.ethereum);
      const netId = getSelectedChainID();
      const currentNet = NETWORKS[netId];
      const partnerNet = NETWORKS[currentNet['partnerChainID']];
      const tokenBridge = currentNet['tokenBridge'];

      const ethProvider = metamaskProvider
      const arbProvider = new ethers.providers.JsonRpcProvider(
        partnerNet['url']
      )
      const l1Signer = ethProvider.getSigner(0);
      const l2Signer = arbProvider.getSigner(connectAddress);
      const bridge = new Bridge(
        tokenBridge['l1Address'],
        tokenBridge['l2Address'],
        l1Signer,
        l2Signer,
      )
      this.bridge = bridge;
      return bridge
    },
    async submitRecharge(info) {
      this.showStatusPop = false;
      this.tipTxt = 'Confirm On The Wallet';
      this.show = true;

      const connectAddress = window.ethereum.selectedAddress;
      if (!utils.isAddress(connectAddress)) {
        Toast.fail(`Wrong Address`);
        return;
      }
      const bridge = this.bridge || this.initBridge();
      // const bridge = initBrideByTransanctionType('l1');
      const ethToL2DepositAmount = parseEther(info.amount);
      // bridge.depositETH(ethToL2DepositAmount, {gas: web3utils.toHex('21000')})
      bridge.depositETH(ethToL2DepositAmount)
      .then(async res=>{
        this.tipTxt = 'In progress, waitting';
        const txHash = res.hash;
        const transactionWaitRes = await res.wait();
        const { confirmations, from, to, transactionHash, status } = transactionWaitRes
        console.log(`transaction success! res:${res},waitRes:${transactionWaitRes}`)
        const submitData = {
          txid: txHash,
          from: res.from || connectAddress,
          to: res.to,
          type: TRANSACTION_TYPE['L1ToL2'],
          status,
          value: info.amount
        }
        this.addHistoryData = _.cloneDeep(submitData);
        await this.addHistory(submitData);
      })
      .catch(error => {
        this.show = false;
        if (error.code == '4001') {
          Toast('Cancel Transaction')
          return
        }
        console.log(error)
        this.showStatusPop = true;
        this.statusPopTitle = 'Deposit Failed'
        this.popStatus = 'fail';
      })
    },
    async addHistory(data) {
      const submitData = data || this.addHistoryData;
      const res = await this.$store.dispatch('AddTransactionHistory', {...submitData});
      this.show = false;
      if (res.hasError) {
        this.showRefresh = true;
        this.showStatusPop = false;
        this.show = false;
        // this.$router.push({ name: 'home' });
        console.log('Transaction success，but error when add history')
      } else {
        this.showStatusPop = true;
        this.statusPopTitle = 'Transfer Submitted'
        this.popStatus = 'success';
        prettyLog('transaction is in progress，waiting fro 10s....')
        await wait(10000);
        this.showStatusPop = false;
        this.$eventBus.$emit('handleUpdateTransactionHistory', {type: 'L1ToL2'});
        this.$router.push({ name: 'home' });
      }
      return { hasError: res.hasError };
    },
    async retryAddHistory() {
      this.refreshing = true;
      const res = await this.addHistory();
      if (!res.hasError) {
        this.showRefresh = false;
      } else {
        this.refreshing = false;
        Toast('Faild, can retry')
      }
    },
    async handleChainChanged({netId, showTip}) {
      if (showTip) {
        this.showNetTip = false;
        return
      }
      const mode = getNetMode(netId)
      if (mode !== 'l1') {
        this.showNetTip = true;
        await this.$store.dispatch('WalletLockStatus', {isLock: true});
      } else {
        this.showNetTip = false;
      }
    },
    changeVisible() {
      if (this.popStatus === 'success') {
        this.$router.push({ name: 'home' });
      }
    },
    creatQrCode() {
      const refNode = this.$refs.qrCodeUrl  // childNodes(array)  childElementCount(as same as elemnt.children.length)
      if (this.walletIsLock || !refNode || !this.defaultAddress || refNode && refNode.childElementCount >0) {
        return;
      }
      new QRCode(this.$refs.qrCodeUrl, {
        text: this.defaultAddress,
        width: 120,
        height: 120,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H,
      })
    },
  },
  mounted() {
    this.$eventBus.$on('chainChanged', this.handleChainChanged);
  },
}
</script>
<style lang="scss" scoped>
  @import 'index';
</style>
