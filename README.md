# Renewvia-REC
Blockchain-Based Carbon Assets

For more information, please visit [our website](https://www.r-recs.com/).

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
|   +-- install.sh                          Installs Foundry and OpenZeppelin dependencies
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