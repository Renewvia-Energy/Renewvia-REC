const app = Vue.createApp({
    data() {
        return {
            isHidden: true,
            isHiddenCategory: true,
            carbonAssetsData: [],
            allTransactions: [],
            newStates: [],
            cart: [],
            showModal: false,
            currentPage: 1,
            itemsPerPage: 6, // Number of items per page
            pageWindow: 2, // Number of pages to show around the current page
            categories: [
              { id: 1, name: 'All' },
              { id: 2, name: 'Solar' },
              { id: 3, name: 'Hydro' },
              { id: 4, name: 'Wind' },
              { id: 5, name: 'Geothermal' },
              { id: 6, name: 'Biomass' },
            ],
            countries: [
              { id: 1, name: 'All' },
              { id: 2, name: 'Kenya' },
              { id: 3, name: 'Nigeria' },
              { id: 4, name: 'Uganda' },
              { id: 5, name: 'United States' },
              { id: 6, name: 'Zambia' },
              { id: 7, name: 'Others' },
            ],
            // Selected categories and countries
            selectedCategories: [],
            selectedCountries: [],
            };
        },
    
    mounted() {
        this.statesData();
        // Retrieve cart from session storage on component mount
        const storedCart = sessionStorage.getItem('cart');
        if (storedCart) {
          this.cart = JSON.parse(storedCart);
        }
      },
      computed: {
        totalItemsInCart() {
          return this.cart.reduce((total, item) => total + item.quantity, 0);
        },
        totalPerAsset() {
          const totalPerAsset = {};
          this.cart.forEach(item => {
            totalPerAsset[item.address] = item.price * item.quantity; // Assuming item.price is the price of the asset
          });
          return totalPerAsset;
        },
        totalCartValue() {
          return this.cart.reduce((total, item) => total + item.price * item.quantity, 0);
        },
        paginatedData() {
          const startIndex = (this.currentPage - 1) * this.itemsPerPage;
          const endIndex = this.currentPage * this.itemsPerPage;
          let manipulatedData = this.carbonAssetsData
          if (this.filteredData){
            manipulatedData = this.filteredData
          }

          return manipulatedData.slice(startIndex, endIndex);
        },
        totalPages() {
          return Math.ceil(this.carbonAssetsData.length / this.itemsPerPage);
        },
        visiblePages() {
          const pageStart = Math.max(this.currentPage - this.pageWindow, 1);
          const pageEnd = Math.min(this.currentPage + this.pageWindow, this.totalPages);
          return Array.from({ length: pageEnd - pageStart + 1 }, (_, i) => pageStart + i);
        },
        filteredData() {
          let filteredData = this.carbonAssetsData;
    
          if (this.selectedCategories.length > 0 && !this.selectedCategories.includes('All')) {
            filteredData = filteredData.filter(asset => this.selectedCategories.includes(asset.category));
          }
    
          if (this.selectedCountries.length > 0 && !this.selectedCountries.includes('All')) {
            filteredData = filteredData.filter(asset => this.selectedCountries.includes(asset.country));
          }
          return filteredData;
        },
      },
      watch: {
        selectedCategories: function () {
          this.updateFilteredData();
        },
        selectedCountries: function () {
          this.updateFilteredData();
        }
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
                        this.carbonAssetsData = allContractsData
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
            });
          },
          addToCart(asset) {
            const existingItem = this.cart.find(item => item.address === asset.address);
            if (existingItem) {
              existingItem.quantity += 1;
            } else {
              asset.quantity = 1;
              this.cart.push(asset);
            }
            sessionStorage.setItem('cart', JSON.stringify(this.cart));
          },
          removeFromCart(asset) {
            const existingItem = this.cart.find(item => item.address === asset.address);
            if (existingItem) {
              if (existingItem.quantity > 1) {
                existingItem.quantity -= 1;
              } else {
                const index = this.cart.findIndex(item => item.address === asset.address);
                this.cart.splice(index, 1);
              }
              sessionStorage.setItem('cart', JSON.stringify(this.cart));
            }
          },
          getQuantity(asset) {
            const cartItem = this.cart.find(item => item.address === asset.address);
            return cartItem ? cartItem.quantity : 0;
          },
          purchase(){
            this.showModal = true;
          },
          openModal() {
            this.showModal = true;
          },
          closeModal() {
            this.showModal = false;
          },
          goToCheckout() {
            window.location.href = '/checkout.html';
          },
          nextPage() {
            if (this.currentPage < this.totalPages) {
              this.currentPage++;
            }
          },
          prevPage() {
            if (this.currentPage > 1) {
              this.currentPage--;
            }
          },
          jumpToPage(page) {
            this.currentPage = page;
          },
          updateFilteredData() {
            this.$nextTick(() => {
              // Re-filter the data when the selected categories or countries change
              this.filteredData;
            });
          },
          toggleMenu(){
            this.isHidden = !this.isHidden;
          },
          toggleCategory(){
            this.isHiddenCategory = !this.isHiddenCategory;
          },
      
        },
});
app.mount('#dashboard')