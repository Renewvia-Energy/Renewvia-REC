const app = Vue.createApp({
  data() {
    return {
      isHidden: true,
      carbonAssetsData: [],
      companyData: [],
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
    if (!this.chart) {
      // Render the chart with the new data
      this.renderChart();
    }
  },
  methods: {
    statesData() {
      const walletAddress = window.location.href.split("?")[1];
      const contracts_url =
        "https://raw.githubusercontent.com/Faith-Kimongo/Renewvia-REC/main/R-REC-NEW/contracts.json";
      const companies_url =
        "https://raw.githubusercontent.com/Faith-Kimongo/Renewvia-REC/main/R-REC-NEW/companies.json";

      // Get all the contracts from json in github
      fetch(contracts_url)
        .then((allContractsResp) => allContractsResp.json())
        .then((allContractsData) => {
          // loop through each contract and add key for qyt and transactions
          for (let i = 0; i < allContractsData.length; i++) {
            // set the key values for qty to 0 and transaction to empty array
            allContractsData[i]["chartData"] = {};
          }
          
          // filter the contracts if company address is passed in the url
          if (walletAddress) {
            this.carbonAssetsData = allContractsData.filter(
              (asset) => asset.company_address === walletAddress
              );
              // getting company data
              fetch(companies_url)
              .then((allCompaniesResp) => allCompaniesResp.json())
              .then((allCompanyData) => {
                // putting ellipsis in between company address
                for (let i = 0; i < allCompanyData.length; i++) {
                  if (allCompanyData[i].address === walletAddress) {
                    let smallAdress = allCompanyData[i].address;
                    let startSubStr = smallAdress.substr(0, 4)
                    let endSubStr = smallAdress.substr(-4)
                    smallAdress = startSubStr+'...'+endSubStr
                    allCompanyData[1]['smallAddress'] = smallAdress
                    this.companyData.push(allCompanyData[i]);
                  }
                }
              });
            }
            // if no company address is passed on the url return all the contracts
            if (!walletAddress) {
              this.carbonAssetsData = allContractsData;
          }

          // call function(method) to calculate renewable energy Total
          this.calculateRenewableEnergy();

          //passing the data to the chart
          for (let contract of this.carbonAssetsData) {
            const labels = this.carbonAssetsData.map((asset) => asset.name);
            const quantities = this.carbonAssetsData.map((asset) => asset.qty);

            this.doughnutData = {
              labels: labels,
              datasets: [
                {
                  backgroundColor: [
                    "#FF5733",
                    "rgb(239, 216, 6)",
                    "#ff6d05",
                    "rgb(218, 148, 68)",
                  ], // Add colors as needed
                  data: quantities,
                },
              ],
            };
            contract.chartData = this.doughnutData;
          }
        });
    },
    calculatePercentage(quantity) {
      // Calculate the percentage here based on the total quantity
      if (quantity === 0) {
        return 0;
      }
      const totalQuantity = this.carbonAssetsData.reduce(
        (total, asset) => total + asset.qty,
        0
      );
      const answer = Math.round((quantity / totalQuantity) * 100);
      return answer;
    },

    calculateRenewableEnergy() {
      let total = 0;
      for (let asset of this.carbonAssetsData) {
        // calculating renewable energy total using hardcoded value
        total = total + asset.qty;
      }
      this.totalRenewableEnergy = total;
    },
    renderChart() {
      if (
        this.$refs.myChart &&
        this.carbonAssetsData &&
        this.carbonAssetsData.length > 0
      ) {
        const ctx = this.$refs.myChart.getContext("2d");
        if (ctx) {
          this.chart = new Chart(ctx, {
            type: "doughnut",
            data: this.carbonAssetsData[this.carbonAssetsData.length - 1]
              .chartData,
            options: {
              responsive: true,
              maintainAspectRatio: false,
            },
          });
        }
      }
    },
    toggleMenu() {
      this.isHidden = !this.isHidden;
    },
  },
});
app.mount("#app");
