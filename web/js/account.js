const WALLET = window.location.href.split("?")[1];
const CONTRACTS_URL = "https://www.r-recs.com/web/js/contracts.json";
const COMPANIES_URL = "https://www.r-recs.com/web/js/companies.json";
const RETIREMENT_WALLET = '0x51475BEdAe21624c5AD8F750cDBDc4c15Ca8F93f';
const RETURN_WALLET = '0x6E61B86d97EBe007E09770E6C76271645201fd07';
const FULL_GOAL_CIRCLE = 850;

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
			assetDates: [],
			assetTimeSeries: [],
			retired_carbon: 0,
			chart: null,
			generationChart: null,
			loadingCompanies: true,
			loadingContracts: true,
		}
	},

	mounted() {
		this.fetchCompanies().then(() => {
			this.fetchContracts().then(()=> {
				this.renderChart()

				this.renderGenerationTimeSeries()

				// Update carbon goal progress
				if (this.carbon_goal) {
					document.getElementById('retired-carbon').setAttribute('stroke-dasharray', `${Math.round(FULL_GOAL_CIRCLE * Math.min(this.retired_carbon / this.carbon_goal, 1))}, 999`)
					document.getElementById('total-carbon').setAttribute('stroke-dasharray', `${Math.round(FULL_GOAL_CIRCLE * Math.min((this.retired_carbon + this.totalCarbonOffsets) / this.carbon_goal, 1))} 999`)
				}
			})
		})
	},

	computed: {
		totalRenewableEnergy() {
			return this.assets.reduce((sum, asset) => asset.superclass === 'REC' ? sum+asset.amount : sum, 0)
		},

		totalCarbonOffsets() {
			return this.assets.reduce((sum, asset) => asset.superclass === 'CC' ? sum+asset.amount : sum, 0)
		},

		// Note: This is weird, and we should probably simplify it later. When this was written, we hadn't minted any carbon credits, but we still wanted to show approximate carbon offset. Think of it like "If you converted all of your RECs to CCs, how many carbon credits would you have?" 1451 is from AVERT, and 2205 is the number of pounds in one ton.
		totalEstimatedCarbonOffsets() {
			var carbonCredits = this.totalCarbonOffsets
			if (carbonCredits == 0) {
				return Math.round(this.assets.reduce((sum, asset) => asset.superclass === 'REC' ? sum+asset.amount : sum, 0)*1451/2205)+this.retired_carbon
			} else {
				return carbonCredits+this.retired_carbon
			}
		},

		instructionsToAchieveCarbonGoal() {
			// If you haven't reached your goal yet
			if (this.carbon_goal > this.retired_carbon) {
				let instr = `So far, you have retired ${this.retired_carbon.toLocaleString()} carbon credits. You currently own ${this.totalCarbonOffsets.toLocaleString()}. To achieve your goal of retiring ${this.carbon_goal.toLocaleString()} carbon credits, `

				// If you could reach your goal by retiring what you already have
				if (this.retired_carbon + this.totalCarbonOffsets >= this.carbon_goal) {
					return instr + `retire at least ${(this.carbon_goal-this.retired_carbon).toLocaleString()} more carbon credits.`

				// If you need to buy or convert more credits in order to reach your goal
				} else {
					instr+= `purchase at least ${(this.carbon_goal - this.totalCarbonOffsets - this.retired_carbon).toLocaleString()} more carbon credits, then retire at least ${(this.carbon_goal - this.retired_carbon).toLocaleString()} carbon credits.`
					
					// If you have RECs you could convert to carbon credits
					if (this.totalRenewableEnergy > 0) {
						instr+= ` You do have ${(this.totalRenewableEnergy).toLocaleString()} renewable energy credits (RECs) that you can exchange for carbon credits, which may help you achieve your carbon goal.`
					}

					return instr
				}
				
			// If you have reached your goal
			} else {
				return `Congratulations! You have accomplished your goal of retiring ${this.carbon_goal} carbon credits.`
			}
		},

		cumulativeAssetTimeSeriesMWh() {
			return this.assetTimeSeries.map((sum => value => sum += value/1000)(0))
		}
	},

	methods: {
		async fetchCompanies() {
			try {
				const companiesResp = await fetch(COMPANIES_URL)
				const companies = await companiesResp.json()

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
			} catch (error) {
				console.error('Error fetching companies data:', error)
			} finally {
				this.loadingCompanies = false
			}
		},

		async fetchContracts() {
			try {
				// Scrape the contracts for transactions involving this wallet
				const allContractsResp = await fetch(CONTRACTS_URL)
				const allContractsData = await allContractsResp.json()
				
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
									// If the action is a transfer from the return wallet, log accordingly
									if (strcmpi(trans['from'], RETURN_WALLET)) {
										trans.action = 'Receipt'
									} else {
										trans.action = strcmpi(trans['from'], WALLET) ? 'Sale' : 'Purchase'
									}
									break
								case 'mint':
									trans.action = 'Generation'
									break
								case 'return':
									trans.action = 'Return'
									break
								case 'retire':
									this.retired_carbon+= trans.amount
									trans.action = 'Retirement'
									break
								default:
									trans.action = trans.action.charAt(0).toUpperCase() + trans.action.slice(1)
							}
							trans.name = contract.name
							let date = new Date(trans.timeStamp*1000)
							trans.date = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`
							this.activity.push(trans)

							// Does this asset already exist? If so, where is it in this.assets?
							let ind = -1
							for (let a=0; a<this.assets.length; a++) {
								if (this.assets[a].address == contract.address) {
									ind = a
									break
								}
							}

							// If the asset doesn't already exist in this.assets, add it. Otherwise, just update the amount
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

							// If this transaction has verification data associated, download it from GitHub and add it to the time series chart
							if (trans.verification_data) {
								try {
									const verificationDataResp = await fetch(trans.verification_data)
									const csvText = await verificationDataResp.text()
									let lines = csvText.split('\n')

									// Trim the header rows
									lines = lines.slice(lines.findIndex((line) => line.trim() === ',') + 2)

									// For each line of actual data
									for (let line of lines) {
										let data = line.split(',')

										// If it has data in it, extract it and add it to the time series
										if (data.length > 1) {
											let date = new Date(data[0])
											let timeIndex = findInsertionIndex(this.assetDates, date)

											// If that date already exists, just add the amount. Otherwise, create a new element for that date.
											if (this.assetDates.length > timeIndex && this.assetDates[timeIndex].getTime() === date.getTime()) {
												this.assetTimeSeries[timeIndex]+= parseFloat(data[1])
											} else {
												this.assetDates.splice(timeIndex, 0, date)
												this.assetTimeSeries.splice(timeIndex, 0, parseFloat(data[1]))
											}
										}
									}
								} catch (error) {
									console.error(`Error fetching verification data from block ${trans['blockNumber']}:`, error)
								}
							}
						}
					}
				}
				this.assets = this.assets.filter((asset) => asset.amount>0)
				this.activity.sort((action1, action2) => action1.timeStamp-action2.timeStamp)
			} catch (error) {
				console.error('Error loading contracts:', error)
			} finally {
				this.loadingContracts = false
			}
		},

		calculatePercentage(quantity) {
			// Calculate the percentage here based on the total quantity
			const totalQuantity = this.assets.reduce((total, asset) => total + asset.amount, 0)
			return Math.round(100 * quantity / totalQuantity)
		},

		renderChart() {
			if (this.$refs.myChart && this.assets && this.assets.length > 0) {
				const ctx = this.$refs.myChart.getContext("2d");
				if (ctx) {
        			// Destroy the existing chart if it exists
					if (this.chart) {
						this.chart.destroy();
					}

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
		},

		renderGenerationTimeSeries() {
			if (this.$refs.generationGraph && this.assetDates && this.assetDates.length > 0 && this.assetTimeSeries && this.assetTimeSeries.length > 0) {
				const ctx = this.$refs.generationGraph.getContext("2d");
				if (ctx) {
        			// Destroy the existing chart if it exists
					if (this.generationChart) {
						this.generationChart.destroy();
					}
					
					// Create a new chart
					this.generationChart = new Chart(ctx, {
						type: 'line', // Use a line chart
						data: {
							labels: this.assetDates, // Dates on the x-axis
							datasets: [
								{
									label: 'Energy Generated', // Label for the dataset
									data: this.cumulativeAssetTimeSeriesMWh.map((value, index) => ({
										x: this.assetDates[index],
										y: value
									})), // Energy values on the y-axis
									borderColor: 'rgba(240, 99, 00, 1)', // Line color
									backgroundColor: 'rgba(240, 99, 00, 0.2)', // Fill color
									borderWidth: 2, // Line width
									fill: true, // Fill under the line
								},
							],
						},
						options: {
							responsive: true, // Make the chart responsive
							scales: {
								x: {
									type: 'time', // Use a time scale for the x-axis
									time: {
										unit: 'month', // Default time unit (can be 'hour', 'day', 'month', etc.)
										tooltipFormat: 'yyyy-MM-dd', // Format for tooltips
									},
									title: {
										display: true,
										text: 'Date', // X-axis label
									},
									ticks: {
										maxTicksLimit: 12
									}
								},
								y: {
									title: {
										display: true,
										text: 'Energy Generated (MWh)', // Y-axis label
									},
								},
							},
							plugins: {
								tooltip: {
									callbacks: {
										title: (context) => {
											// Format the tooltip title to show the full datetime
											const date = new Date(context[0].raw.x || context[0].label);
											return date.toLocaleDateString();
										},
										label: (context) => {
											// Format the tooltip label to show the energy value
											return `Energy: ${Math.floor(context.raw.y)} MWh`;
										},
									},
								},
							},
						},
					});
				}
			}
		}
	},
});

app.mount("#app")