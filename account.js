const WALLET = window.location.href.split("?")[1];
const CONTRACTS_URL = "https://www.r-recs.com/contracts.json";
const COMPANIES_URL = "https://www.r-recs.com/companies.json";

function strcmpi(str1, str2) {
	return str1.localeCompare(str2, undefined, {sensitivity: 'base'}) === 0
}

const app = Vue.createApp({
	data() {	
		return {
			name: '',
			address: WALLET,
			smallAddress: WALLET.substring(0,4)+'...'+WALLET.substring(WALLET.length-4),
			logo: '',
			join_date: '',
			assets: [],
			activity: [],
			chart: null
		}
	},

	mounted() {
		fetch(COMPANIES_URL)
		.then((companiesResp) => companiesResp.json())
		.then((companies) => {
			// Find my company in the list of companies
			for (company of companies) {
				if (company.address.toLowerCase() === WALLET.toLowerCase()) {
					this.name = company['name']
					this.logo = company['logo']
					this.join_date = company['join_date']
					this.carbon_goal = company['carbon_goal']
					this.rec_goal = company['rec_goal']
					break
				}
			}
			// If not registered, load default values
			if (!this.name) {
				this.name = 'R-REC User'
				this.logo = 'https://static.wixstatic.com/media/f3e4c8_605e4a0db8f94c88ba747298bcdf3648~mv2.png/v1/crop/x_105,y_113,w_814,h_812/fill/w_812,h_812,al_c,q_90,enc_auto/Renewvia%20logo_50.png'
				this.join_date = 'Yet to be Verified'
			}
			// Scrape the contracts for transactions involving this wallet
			fetch(CONTRACTS_URL)
				.then((allContractsResp) => allContractsResp.json())
				.then((allContractsData) => {
					// For each contract
					for (let contract of allContractsData) {
						// For each transaction of that contract
						for (let trans of contract['transactions']) {
							if (trans.ignore || 
								(trans.action==='mint' && strcmpi(trans['from'],WALLET) && !strcmpi(trans['to'],WALLET))) {
								continue
							}
							// If this wallet is involved in the transaction
							if (strcmpi(trans['to'], WALLET) || strcmpi(trans['from'], WALLET)) {
								// Make the amount negative if this wallet is the sender
								trans.signedAmount = strcmpi(trans['from'], WALLET) ? trans.amount*-1 : trans.amount

								// Add the transaction to the activity table
								switch (trans.action) {
									case 'transfer':
										trans.action = strcmpi(trans['from'], WALLET) ? 'Sale' : 'Purchase'
										break
									case 'mint':
										trans.action = 'Generation'
										break
									default:
										trans.action = trans.action.charAt(0).toUpperCase() + trans.action.slice(1)
								}
								trans.name = contract.name
								let date = new Date(trans.timeStamp*1000)
								trans.date = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`
								this.activity.push(trans)

								// Increment asset count
								let ind = -1
								for (let a=0; a<this.assets.length; a++) {
									if (this.assets[a].address == contract.address) {
										ind = a
										break
									}
								}
								if (ind == -1) {
									this.assets.push({
										name: contract.name,
										abbreviation: contract.abbreviation,
										superclass: contract.superclass,
										address: contract.address,
										signedAmount: trans.signedAmount,
										amount: trans.amount,
										img: contract.img,
										description: contract.description
									})
								} else {
									this.assets[ind].amount+= trans.signedAmount
								}
							}
						}
					}
					this.assets = this.assets.filter((asset) => asset.amount>0)
					this.activity.sort((action1, action2) => action1.timeStamp-action2.timeStamp)
				})
		})
	},

	updated() {
		if (!this.chart) {
			// Render the chart with the new data
			this.renderChart();
		}
	},

	computed: {
		totalRenewableEnergy() {
			return this.assets.reduce((sum, asset) => asset.superclass === 'REC' ? sum+asset.amount : sum, 0)
		},

		// Note: This is weird, and we should probably simplify it later. When this was written, we hadn't minted any carbon credits, but we still wanted to show approximate carbon offset. Think of it like "If you converted all of your RECs to CCs, how many carbon credits would you have?" 1451 is from AVERT, and 2205 is the number of pounds in one ton.
		totalCarbonOffsets() {
			var carbonCredits = this.assets.reduce((sum, asset) => asset.superclass === 'CC' ? sum+asset.amount : sum, 0)
			if (carbonCredits == 0) {
				return Math.round(this.assets.reduce((sum, asset) => asset.superclass === 'REC' ? sum+asset.amount : sum, 0)*1451/2205)
			} else {
				return carbonCredits
			}
		}
	},

	methods: {
		calculatePercentage(quantity) {
			// Calculate the percentage here based on the total quantity
			const totalQuantity = this.assets.reduce((total, asset) => total + asset.amount, 0)
			return Math.round(100 * quantity / totalQuantity)
		},

		renderChart() {
			if (this.$refs.myChart && this.assets && this.assets.length > 0) {
				const ctx = this.$refs.myChart.getContext("2d");
				if (ctx) {
					this.chart = new Chart(ctx, {
						type: "doughnut",
						data: {
							labels: this.assets.map((asset) => asset.name),
							datasets: [
								{
									backgroundColor: [
										"#FF5733",
										"rgb(239, 216, 6)",
										"#ff6d05",
										"rgb(218, 148, 68)",
									], // Add colors as needed
									data: this.assets.map((asset) => asset.amount),
								}
							]
						},
						options: {
							responsive: true,
							maintainAspectRatio: false,
						},
					});
				}
			}
		}
	},
});

app.mount("#app");