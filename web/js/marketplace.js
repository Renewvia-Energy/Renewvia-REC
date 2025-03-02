const CONTRACTS_URL = "https://www.r-recs.com/contracts.json";
// const COMPANIES_URL = "https://www.r-recs.com/companies.json";
// const RETIREMENT_WALLET = '0x51475BEdAe21624c5AD8F750cDBDc4c15Ca8F93f';
// const RETURN_WALLET = '0x6E61B86d97EBe007E09770E6C76271645201fd07';

// function strcmpi(str1, str2) {
// 	return str1.localeCompare(str2, undefined, {sensitivity: 'base'}) === 0
// }

const app = Vue.createApp({
	data() {	
		return {
			contracts: []
		}
	},

	mounted() {
		// Scrape the contracts for transactions involving this wallet
		fetch(CONTRACTS_URL)
			.then((allContractsResp) => allContractsResp.json())
			.then((allContractsData) => {
				// For each contract
				for (let contract of allContractsData) {
					let tokenCount = 0
					// For each transaction of that contract
					for (let trans of contract['transactions']) {
						if (trans.ignore) {
							continue
						}
						if (trans.action == 'mint') {
							tokenCount+= trans.amount
						} else if (trans.action == 'return' || trans.action == 'retire') {
							tokenCount-= trans.amount;
						}
					}
					
					if (tokenCount>0) {
						this.contracts.push({
							name: contract.name,
							amount: tokenCount
						})
					}
				}
			})
	}
});

app.mount("#app");