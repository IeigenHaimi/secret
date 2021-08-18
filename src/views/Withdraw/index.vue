<template>
  <div class="withdraw-page">
    <van-row type="flex" justify="space-between" align="center" class="top-address">
      <van-col span="12" class="textAlignLeft">提现地址</van-col>
      <van-col span="12" class="textAlignRight">
        <van-button color="#E4E6F5" size="mini" @click="setMyAddress">
          <span slots="default" style="coloe:#495ABE">我的地址</span>
        </van-button>
      </van-col>
    </van-row>
    <div class="withdraw-opt-area">
      <div class="flex flex-center address-wrapper">
        <div class="address-wrapper-inner">
          <van-field
            v-model="withDrawAddress"
            rows="2"
            autosize
            label=""
            type="textarea"
            :disabled="walletIsLock"
            placeholder="请输入提现地址"
            @input="handleAddressInputChange"
          />
        </div>
      </div>
      <v-tokenAmount
        key="tokenAmount-withdraw"
        type="withdraw"
        @childEvent="submitWithdraw"
        :buttonCode="tokenAmountButtonTxtCode"
        :buttonTxt="tokenAmountButtonTxt" />
    </div>
    <v-exchangeList key="comon-exchangeList" type="withdraw" v-show="!walletIsLock"/>
    <v-statusPop
      :status="popStatus"
      title="您的提现已提交"
      timeTxt="预计等待 20-40 分钟汇出"
      tip="请在链上钱包中查看到账情况"
      :show="showStatusPop"
      @childEvent="changeVisible" />
    <!-- <van-popup v-model="show" round :close-on-click-overlay="false" class="waiting-modal flex flex-center flex-column">
      <div>交易正在进行</div>
      <div>请耐心等待<van-count-down :time="time" /></div>
    </van-popup> -->
    <van-popup v-model="show" round :close-on-click-overlay="false" class="waiting-modal flex flex-center flex-column">
      <div>交易正在进行</div>
      <div>请耐心等待</div>
    </van-popup>
  </div>
</template>
<script>
import Vue from 'vue';
import { Popup, CountDown, Field, Toast } from 'vant';
import TokenAmount from '@/components/TokenAmount';
import ExchangeList from '@/components/ExchangeList';
import StatusPop from '@/components/StatusPop';
import { wait, prettyLog } from '@/utils/index'
import { getDefaultAddress } from '@/utils/auth'

import {
  rpcProvider, walletForRPC, bridgeAboutWalletForRPC,
  getAvailableBalanceForL1,getAvailableBalanceForL2, } from '@/utils/walletBridge'

import { providers, utils, Wallet, BigNumber, constants } from 'ethers'
import { Bridge } from 'arb-ts';
import {
  address,
  DEVNET_PRIVKEY,
  ethRPC,
  arbRPC
} from '@/utils/global';

Vue.use(Popup);
Vue.use(CountDown);
Vue.use(Field);
Vue.use(Toast);

const { parseEther } = utils;

export default {
  name: "withdraw",
  components: {
    'v-exchangeList': ExchangeList,
    'v-tokenAmount': TokenAmount,
    'v-statusPop': StatusPop,
  },
  data() {
    return {
      popStatus: 'sucess',
      showStatusPop: false,
      show: false,
      time: 10 * 1000,
      tokenAmountButtonTxtCode: 1,
      tokenAmountButtonTxt: '请输入金额',
      withDrawAddress: getDefaultAddress(this.$store),
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
      return this.$store.state.metamask.accountsArr[0] || ''
    },
    provider() {
      return rpcProvider()
    },
    wallet() {
      return walletForRPC()
    },
    bridge() {
      return bridgeAboutWalletForRPC()
    },
  },
  watch: {
    walletIsLock(newValue, oldValue) {
      !newValue && (this.withDrawAddress = getDefaultAddress(this.$store));
    },
  },
  methods: {
    setMyAddress() { },
    changeVisible() {},
    handleAddressInputChange(value) {
      this.withDrawAddress = value;
      if (!utils.isAddress(value)) {
        this.tokenAmountButtonTxt = '地址无效'
        this.tokenAmountButtonTxtCode = 2
        return;
      }
      this.tokenAmountButtonTxt = '请输入金额'
      this.tokenAmountButtonTxtCode = 1
    },
    async submitWithdraw(info) {
      this.show = true;
      const { ethProvider } = this.provider;
      const bridge = this.bridge;
      const inbox = await bridge.l1Bridge.getInbox();  // 这个inbox (address)的作用？
      const inboxAddress = inbox.address;
      if (!utils.isAddress(inboxAddress)) {
        Toast.fail(`账户地址有误，无法进行交易`);
        return;
      }

      // 转换充值金额
      const ethFromL2WithdrawAmount = parseEther(info.amount);
      // const withdrawEthRes = await testBridge.withdrawETH(ethFromL2WithdrawAmount)
      // const withdrawEthRec = await withdrawEthRes.wait()

      bridge.withdrawETH(ethFromL2WithdrawAmount)
      .then(async res2=>{
        // Toast.fail(`交易已取消`);
        //执行交易, TODO 拿到hash之后，就开始把下面的代码进行异步执行， 可以考虑用户自己刷新。
        const initiatingTxnReceipt = await bridge.l2Provider.getTransactionReceipt(
                res2.transactionHash
                )
        if (!initiatingTxnReceipt)
        throw new Error(
                `No Arbitrum transaction found with provided txn hash: ${txnHash}`
                )
        const outGoingMessagesFromTxn = await bridge.getWithdrawalsInL2Transaction(
                initiatingTxnReceipt
        )
        if (outGoingMessagesFromTxn.length === 0)
            throw new Error(`Txn ${txnHash} did not initiate an outgoing messages`)
        const { batchNumber, indexInBatch } = outGoingMessagesFromTxn[0]
        const outgoingMessageState = await bridge.getOutGoingMessageState(
                batchNumber,
                indexInBatch
                )
        console.log(
                `Waiting for message to be confirmed: Batchnumber: ${batchNumber}, IndexInBatch ${indexInBatch}`
                )
        while (!outgoingMessageState === OutgoingMessageState.CONFIRMED) {
    await wait(1000 * 60)
    const outgoingMessageState = await bridge.getOutGoingMessageState(
      batchNumber,
      indexInBatch
    )

    switch (outgoingMessageState) {
      case OutgoingMessageState.NOT_FOUND: {
        console.log('Message not found; something strange and bad happened')
        process.exit(1)
        break
      }
      case OutgoingMessageState.EXECUTED: {
        console.log(`Message already executed! Nothing else to do here`)
        process.exit(1)
        break
      }
      case OutgoingMessageState.UNCONFIRMED: {
        console.log(`Message not yet confirmed; we'll wait a bit and try again`)
        break
      }

      default:
        break
    }
  }
   const res = await bridge.triggerL2ToL1Transaction(batchNumber, indexInBatch)
  //const rec = await res.wait()

  console.log('Done! Your transaction is executed', res)


        const walletL1EthBalance = await getAvailableBalanceForL1()
        const walletL2EthBalance = await getAvailableBalanceForL2()
        console.log('交易进行完成后获取L1和L2余额', walletL1EthBalance.toString(), walletL2EthBalance.toString())
        await wait()
        // this.showStatusPop = true;
        prettyLog('交易正在进行，请耐心等待10s....')
        await wait(10000);
        this.show = false;
        // this.showStatusPop = false;
        this.$router.push({ name: 'Home' });
      })
      .catch(error => {
        Toast.fail(`未知错误`);
        // this.showStatusPop = true;
        console.log(error)
      })
    }
  },
  mounted() {
    console.log("metamask是否安装", this.$store.state.metamask.metamaskInstall)
    console.log('钱包账户是否锁定', this.$store.state.metamask.walletIsLock);
  },
}
</script>

<style lang="scss" scoped>
  @import 'index';
</style>
