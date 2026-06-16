# Renewvia-REC
Blockchain-Based Carbon Assets

For more information, please visit [our website](https://www.r-recs.com/).

## Testing

### Smart Contract Tests (Foundry)
From the `contracts/` directory:
```bash
forge test
```

### Webapp Unit Tests (Vitest)
From the `webapp/` directory:
```bash
npm test          # run once
npm run test:watch  # watch mode
```

### Webapp E2E Tests (Playwright)
E2E tests submit real data to the database and real documents to R2 storage.
A dedicated test user must exist in the database before running them:
```bash
npm run seed:test-user   # one-time setup (re-running is safe)
```

From the `webapp/` directory:
```bash
npm run test:e2e       # headless
npm run test:e2e:ui    # with Playwright UI
```

Each run automatically deletes any leftover `[Playwright Test]` submissions from
previous runs before starting.  To purge them manually at any time:
```bash
npm run cleanup:test-submissions
```

## Repository Overview
```
.
|
+-- contracts
|   +-- lib/                                Foundry and OpenZeppelin dependencies in blockchain contracts
|   +-- script                              Foundry scripts to...
|       +-- AddPermitPermissions.s.sol      ...give permission to one wallet to transact on behalf of another
|       +-- AddToBlacklist.s.sol            ...add a wallet to the blacklist
|       +-- DeployNewContract.s.sol         ...deploy a new class of R-RECs to the blockchain
|       +-- Mint.s.sol                      ...mint tokens from an already-deployed contract on the blockchain
|       +-- Pause.s.sol                     ...pause all transactions related to a given contract
|       +-- RemoveFromBlacklist.s.sol       ...remove a wallet from the blacklist
|       +-- Unpause.s.sol                   ...unpause all transactions related to a given contract
|       +-- Upgrade.s.sol                   ...upgrade a contract with new features
|   +-- src
|       +-- BlacklistableUpgradeable.sol    Abstract class from NicksAPPS enabling blacklist functionality
|       +-- RenewviaREC.sol                 Main R-REC contract
|   +-- test
|       +-- RenewviaREC.t.sol               Foundry test script for R-REC functionality
|   +-- .env.example                        Example environment file to be copied into .env and edited with user information
|   +-- .gitignore                          Foundry-specific gitignore
|   +-- foundry.toml                        Foundry configuration file
|   +-- reee.sh                             Runs deploy or mint scripts with optional broadcast mechanism
|
+-- scripts
|   +-- steamaco/                           Scripts to scrape data from SteamaCo database
|   +-- updateData.py                       Scrapes blockchain to update contracts.json
|   +-- updateData.sh                       Runs updateData.py inside of Python virtual environment (WIP)
|
+-- verification_data/                      Directory containing renewable energy generation data for verification
|
+-- web
|   +-- css/                                Stylesheets for web pages
|   +-- images/                             Images used in web pages
|   +-- js
|       +-- abi.json                        Blockchain application binary interface for RenewviaREC.sol
|       +-- account.js                      Client-side-rendering Vue.JS for account page
|       +-- companies.json                  Database of account information
|       +-- contracts.json                  Local copy of blockchain transactions
|       +-- index.js                        Basic JS animations for homepage
|   +-- scss/                               SCSS to be compiled into CSS
|
+-- .gitattributes
+-- .gitignore
+-- .gitmodules
+-- 404.html                                Default 404 error page
+-- account.html                            Client account page with Vue.JS components
+-- CNAME                                   Canonical URL for homepage, used by GitHub Pages
+-- index.html                              Homepage
+-- instructions.md                         Guide for deploying R-REC contracts
+-- LICENSE                                 GPLv3
+-- README.md                               This document
+-- robots.txt                              Implementation of Robots Exclusion Protocol
+-- sitemap.xml                             List of pages on www.r-recs.com
+-- Standard.pdf                            Standard governing R-RECs
```
