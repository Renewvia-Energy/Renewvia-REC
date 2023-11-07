<template>
  <!DOCTYPE html>
    <html lang="en">
        <head>
            <meta charset="utf-8">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <title>R-RECs App</title>
            <meta name="description" content="">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@100;300;500;700;900&display=swap" rel="stylesheet">
            <!-- <link rel="stylesheet" href="index.css"> -->
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
        </head>
        <body>
            <!-- section nav -->
            <header>
                
                <nav class="nav">
                    <div class="logo">
                        <img src="@/assets/images/renewvia.webp" alt="renewvia-logo">
                        <a onclick="toggleMenu()" id="menuButton"><i class="fas fa-bars"></i>
                        </a>
                    </div>
                    <div class="hide container " id="info">
                        <ul>
                            <li>ABOUT US</li>
                            <li>WHAT ARE R-RECs</li>
                            <li>PRODUCTS</li>
                            <li class="team">OUR TEAM</li>
                            <li class="global">
                                <i class="fas fa-g">
                                    <span class="g"></span>
                                </i>
                                globalcorp</li>
                        </ul>
                    </div>
                    
                </nav>
            </header>

            <!-- end section nav -->

            <!-- section 2  -->
            <div>
                <div class="logo1">
                    <div class="logo-container">
                        <img src="@/assets/images/Artboard.png" alt="company-logo">
                    </div>
                    <div class="column">
                        <div class="inc">Global Corp, Inc.</div>
                        <div class="column1">
                            <div class="binary">0x6Ba...147d</div>
                            <div class="date">Joined Sep 18 2023</div>
                        </div>
                    </div>
        
                </div>
            </div>
            <!-- end section 2 -->
            
            <!-- impact section -->
            <div class="impact">
                <div class="my-impact">
                    <div class="offset">
                        <div class="impact-icon">
                            <h1>Total amount of carbon offset</h1>
                            <i class="fas fa-leaf"></i>
                        </div>
                        
                        <p>{{ carbonAssetsData.gas }} </p>
                    </div>
                    <div>
                        <div class="impact-icon">
                            <h1>Total amount of renewable energy generation</h1>
                            <i class="fas fa-solar-panel"></i>
                        </div>
                        <p>1906 MWh</p>
                    </div>
                </div>
            </div>
            <!-- end impact section -->

            <!-- tables -->
            <div class="tables">
                <div class="two-tables">
                    <div class="table-column">
                        <div class="table1" v-if="carbonAssetsData && carbonAssetsData.length > 0" >
                            <h1>Carbon Assets</h1>
                            <table>
                                <tbody>
                                    <tr class="assets" v-for="asset in carbonAssetsData" :key="asset.id">
                                        <td>{{ asset.name }}</td>
                                        <td><h1>{{ asset.qty }}</h1></td>
                                        <details>
                                            <summary></summary>
                                            <ul v-for="transaction in asset.transactions" :key="transaction.contractAddress" >
                                                <li>Token Name: {{ transaction.tokenName}}</li>
                                                <li>Block Number: {{ transaction.blockNumber}}</li>
                                                <li>Tx Index: {{ transaction.transactionIndex}}</li>
                                                <li>Timestamp: {{ transaction.timeStamp}}</li>
                                            </ul>
                                        </details>
                                    </tr>
                                </tbody>
                                </table>
                        </div>
                        <div class="table2" v-if="carbonAssetsData && carbonAssetsData.length == 1">
                            <h1>Activity</h1>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Carbon Assets</th>
                                        <th>Action</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                    
                                <tbody>
                                    <tr class="assets" v-for="transaction in carbonAssetsData[0].transactions" :key="transaction.contractAddress">
                                        <td>{{ transaction.timeStamp}}</td>
                                        <td> {{ transaction.tokenSymbol}}</td>
                                        <td>Generation</td>
                                        <td>{{ transaction.gasUsed}}</td>
                                        <td><button>Verified</button></td>
                                    </tr>
                                </tbody>

                            </table>
                        </div> 
                    </div>
                

                    <!-- chart -->
                        <div class="pie-chart" v-if="carbonAssetsData && carbonAssetsData.length > 0" >
                            
                            <div>
                                <h1>Carbon assets in four states.</h1>
                                <div class="chart"></div>
                                <ul class="key assets" v-for="asset in carbonAssetsData" :key="asset.id">
                                <li>
                                    <strong class="percent gray">4%</strong>
                                    <span class="choice">{{ asset.name }}</span>
                                </li>
                                </ul> 
        
                                <!-- retire & purchase -->
                                <div class="retire-purchase">
                                        <div class="retire">Retire Current Credits</div>
                                        <div class="credits">Mark Credits for sale</div>
                                        <div class="purchase">Purchase New Credits</div>
                                    
                                </div>
                                <!-- end retire & purchase -->
                            </div>
                        </div>    
                        <!-- end of chart -->
                        
                    
                </div>

            </div>
            <!-- end of tables -->

            <!-- <script src="index.js"></script> -->
        </body>
    </html>
</template>

<script>
export default {
  props: {
    carbonAssetsData: Array,
  },
  // ...
}

</script>

<style>

</style>