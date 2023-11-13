
const app = Vue.createApp({
    data() {
        return {
            isHidden: true,
            carbonAssetsData: [],
            allTransactions: [],
            statesToDisplay: ["Virginia R-REC", "Alabama R-REC", "Georgia R-REC", "North Carolina R-REC", "SteelFab"],
            newStates: [],
            doughnutData: {},
            chart: null,
            totalRenewableEnergy: 0,
            totalCarbonOffsets: 0,
            };
        },
    
    mounted() {
        this.statesData();
    },
    updated() {
    // Check if the chart instance exists and destroy it
    if (this.chart) {
      this.chart.destroy();
    }
    // Render the chart with the new data
    this.renderChart();
    },

    methods: {
        statesData(){
    
          // declear required variables to use on api call
          const API_KEY = "FV7VI88AT9SBQDZU3WYWGPWZNVDUEY9RTW"
          const WALLET_ADDR = "0x9Db94E89DB9798544494a71C01E3552D6adE79bE"
          const stateAddress = window.location.href.split('?')[1]
          const url = 'https://raw.githubusercontent.com/Faith-Kimongo/Renewvia-REC/main/contracts.json'
    
          // Get all the state from json in github
          fetch(url).then(allContractsResp => allContractsResp.json()).then(allContractsData => { 
              // loop through each state and add key for qyt and transactions
              for (let i = 0; i < allContractsData.length; i++){
                // set the key values for qty to 0 and transaction to empty array
                allContractsData[i]['qty'] = 0;
                allContractsData[i]['transactions'] = [];
                allContractsData[i]['chartData'] = {};
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
                      
                      const labels = this.carbonAssetsData.map((asset) => asset.name);
                      const quantities = this.carbonAssetsData.map((asset) => asset.qty);
    
                      this.doughnutData = {
                        labels: labels,
                        datasets: [
                          {
                            backgroundColor: ['#FF5733', 'rgb(239, 216, 6)', '#ff6d05', 'rgb(218, 148, 68)'], // Add colors as needed
                            data: quantities,
                          },]};
                      contract.chartData = this.doughnutData
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
            console.log(this.carbonAssetsData)
            this.calculateToken()

            });
        }, 
        calculatePercentage(quantity) {
              // You can calculate the percentage here based on the total quantity
              if (quantity === 0) {
                  return 0;
                  }
                  const totalQuantity = this.carbonAssetsData.reduce((total, asset) => total + asset.qty, 0);
                  return ((quantity / totalQuantity) * 100).toExponential(2);      
          },

        calculateToken(){
          let total = 0
          for (let asset of this.carbonAssetsData){
            if (asset.transactions.length > 0){
              console.log(asset.name)
              for(let transaction of asset.transactions){
                let token = transaction.value.slice(0, 4)
                token = parseInt(token)
                total = total + token
              }
            }
          }
          this.totalRenewableEnergy = total
        },
        
        renderChart() {
            if (this.$refs.myChart && this.carbonAssetsData && this.carbonAssetsData.length > 0) {
                const ctx = this.$refs.myChart.getContext('2d');
            if (ctx) {
                this.chart = new Chart(ctx, {
                    type: 'doughnut',
                    data: this.carbonAssetsData[this.carbonAssetsData.length - 1].chartData,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                    },
                });
            }
        }
        },
        toggleMenu(){
          this.isHidden = !this.isHidden;
        },
    
      },
});
app.mount('#app')

