<template>
  <!-- <img alt="" src="./assets/logo.png"> -->
  <index :carbon-assets-data="carbonAssetsData" />
  <!-- <Index /> -->
</template>

<script>
import Index from './components/Index.vue'


export default {
  name: 'App',
  components: { Index,
  },
  data() {
    return{
      carbonAssetsData: [],
      allTransactions: [],
      // defining the states to display
      statesToDisplay: ["Virginia R-REC", "Alabama R-REC", "Georgia R-REC", "North Carolina R-REC"],
      newStates: []
    };
  },
  mounted() {
    this.statesData()
  },

  methods: {
    statesData(){

      // declear required variables to use on api call
      const API_KEY = "FV7VI88AT9SBQDZU3WYWGPWZNVDUEY9RTW"
      const WALLET_ADDR = "0x9Db94E89DB9798544494a71C01E3552D6adE79bE"
      const stateAddress = window.location.href.split('?')[1]

      // Get all the state from json in github
      fetch('https://renewvia-energy.github.io/Renewvia-REC/contracts.json')
        .then(allContractsResp => allContractsResp.json())
				.then(allContractsData => { 
          // loop through each state and add key for qyt and transactions
          for (let i = 0; i < allContractsData.length; i++){
            // set the key values for qty to 0 and transaction to empty array
            allContractsData[i]['qty'] = 0;
            allContractsData[i]['transactions'] = [];
          }

          // filter the states if state address is passed in the url
          if (stateAddress){
            this.carbonAssetsData = allContractsData.filter((asset)=> asset.address === stateAddress);
          }
          // if no adress is passed on the url return all the states (filter by statesToDisplay list)
          if (!stateAddress){
					this.carbonAssetsData = allContractsData.filter((asset)=>this.statesToDisplay.includes(asset.name));
          }

            // get token quantity
            for (let contract of  this.carbonAssetsData){
              // set time out
              setTimeout(() => {
                fetch(`https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress=${contract.address}&address=${WALLET_ADDR}&tag=latest&apikey=${API_KEY}`).then(resp => resp.json()).then(data => {
                  contract.qty = data.result.slice(0, -18)
                  console.log(data)
                  });
                  }, parseInt(contract/4)*1000)
                  }

        });

        // get all transactions for REC wallet
        fetch(`https://api.bscscan.com/api?module=account&action=tokentx&address=${WALLET_ADDR}&page=1&offset=0&startblock=0&endblock=999999999&sort=asc&apikey=${API_KEY}`).then(resp => resp.json()).then(data => {this.allTransactions = data.result
        
        // Group transactions as per their contract address
        for (let transaction of this.allTransactions) {
          for (let contract of  this.carbonAssetsData){
            // check if the transaction.contractAddress matches contract.address, add to contract.transaction[]
            if(transaction.contractAddress === contract.address){
              contract.transactions.push(transaction)
              break
            }
          }
        }
        });
    },
  },
}
</script>

<style scoped lang="css">
/* importing our css globally */
@import './assets/css/styles.css';
</style>
