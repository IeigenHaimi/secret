<template>
  <van-popup v-model="show" closeable class="install-wallet-modal">
    <div class="flex flex-center flex-column">
      <a href="https://metamask.io/" target="_blank" class="install-button-outer">
        <van-button class="install-button" color="#AA2E26" plain >Install Metamask</van-button>
      </a>
      <span class="install-guid">Install<a href="https://metamask.io/" target="_blank" >Metamask</a></span>
    </div>
  </van-popup>
</template>

<script>
import Vue from 'vue';
import { Popup } from 'vant';

Vue.use(Popup);

export default {
  name: 'WalletStatus',
  props: ['show'],
  data() {
    return {
      // installWalletModal,
    }
  },
  methods: {
  },
  async mounted() {
    
  },
};
</script>
<style lang="scss" scoped>
  @import "index";
</style>
