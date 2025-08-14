// ===== BLOCKCHAIN NETWORK MANAGEMENT =====
const {xrpl, StellarSdk} = SecureWalletBundle;

// ===== PRICE WIDGET MODULE =====
const PriceWidget = {
    // Configuration
    config: {
        refreshInterval: 60000, // 1 minute
        cacheDuration: 30000,   // 30 seconds cache
        apiBaseUrl: 'https://api.coingecko.com/api/v3',
        cryptoMap: {
            'XRPL': 'ripple',
            'XLM': 'stellar'
        },
        symbolMap: {
            'XRPL': 'XRP',
            'XLM': 'XLM'
        }
    },

    // Cache
    cache: new Map(),
    refreshTimer: null,

    // Initialize
    init() {
        this.bindEvents();
        this.updateWidget();
        this.startAutoRefresh();
    },

    // Event bindings
    bindEvents() {
        // Update when blockchain changes
        $('#blockchain-select').on('change', () => {
            this.updateWidget();
        });
    },

    // Get current blockchain
    getCurrentBlockchain() {
        return $('#blockchain-select').val() || 'XRPL';
    },

    // Get crypto ID for API
    getCryptoId(blockchain) {
        return this.config.cryptoMap[blockchain] || 'ripple';
    },

    // Get display symbol
    getSymbol(blockchain) {
        return this.config.symbolMap[blockchain] || 'XRP';
    },

    // Check cache
    isCacheValid(cryptoId) {
        const cached = this.cache.get(cryptoId);
        if (!cached) return false;
        return (Date.now() - cached.timestamp) < this.config.cacheDuration;
    },

    // Fetch price data
    async fetchPriceData(cryptoId) {
        try {
            const response = await fetch(
                `${this.config.apiBaseUrl}/simple/price?ids=${cryptoId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`
            );
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data[cryptoId]) {
                throw new Error('Données non disponibles');
            }

            const priceData = {
                price: data[cryptoId].usd,
                change24h: data[cryptoId].usd_24h_change,
                volume24h: data[cryptoId].usd_24h_vol,
                marketCap: data[cryptoId].usd_market_cap,
                timestamp: Date.now()
            };

            // Cache the data
            this.cache.set(cryptoId, priceData);
            
            return priceData;
        } catch (error) {
            console.error('Error fetching price data:', error);
            throw error;
        }
    },

    // Format numbers
    formatNumber(num, decimals = 2) {
        if (num >= 1e9) {
            return (num / 1e9).toFixed(1) + 'B';
        }
        if (num >= 1e6) {
            return (num / 1e6).toFixed(1) + 'M';
        }
        if (num >= 1e3) {
            return (num / 1e3).toFixed(1) + 'K';
        }
        return num.toFixed(decimals);
    },

    // Format price
    formatPrice(price) {
        if (price >= 1) {
            return `$${price.toFixed(2)}`;
        }
        return `$${price.toFixed(4)}`;
    },

    // Show loading state
    showLoading() {
        $('#priceWidget .price-loading').show();
        $('#priceWidget .price-content').hide();
        $('#priceWidget .price-error').hide();
    },

    // Show error state
    showError() {
        $('#priceWidget .price-loading').hide();
        $('#priceWidget .price-content').hide();
        $('#priceWidget .price-error').show();
    },

    // Update widget display
    async updateWidget() {
        const blockchain = this.getCurrentBlockchain();
        const cryptoId = this.getCryptoId(blockchain);
        const symbol = this.getSymbol(blockchain);

        this.showLoading();

        try {
            let priceData;

            // Check cache first
            if (this.isCacheValid(cryptoId)) {
                priceData = this.cache.get(cryptoId);
            } else {
                priceData = await this.fetchPriceData(cryptoId);
            }

            // Update display
            this.displayPriceData(symbol, priceData);
            
        } catch (error) {
            this.showError();
        }
    },

    // Display price data
    displayPriceData(symbol, data) {
        // Update symbol
        $('#cryptoSymbol').text(symbol);
        
        // Update price
        $('#currentPrice').text(this.formatPrice(data.price));
        
        // Update price change
        const changeElement = $('#priceChange');
        const change = data.change24h || 0;
        const changeText = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
        
        changeElement.text(changeText);
        changeElement.removeClass('positive negative');
        changeElement.addClass(change >= 0 ? 'positive' : 'negative');
        
        // Update market data
        $('#volume24h').text('$' + this.formatNumber(data.volume24h || 0));
        $('#marketCap').text('$' + this.formatNumber(data.marketCap || 0));
        
        // Show content
        $('#priceWidget .price-loading').hide();
        $('#priceWidget .price-error').hide();
        $('#priceWidget .price-content').show();
    },

    // Start auto refresh
    startAutoRefresh() {
        this.stopAutoRefresh(); // Clear existing timer
        this.refreshTimer = setInterval(() => {
            this.updateWidget();
        }, this.config.refreshInterval);
    },

    // Stop auto refresh
    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    },

    // Destroy
    destroy() {
        this.stopAutoRefresh();
        this.cache.clear();
    }
};
       
const CLASSES = {
    //------------------------------------- XRPL -------------------------------------------
    "XRPL": class XRPL {
        static serverURL = { "main":"wss://xrplcluster.com", "test":"wss://s.altnet.rippletest.net:51233"};
        static isLibLoaded(){
            return !(typeof xrpl === "undefined");
        }
        static curMaxLen = 6;
        static LLIAdd = 180;//amount to add to last ledger index to ensure we have time to do the transaction with USB key
        symbol = "XRP";
        constructor(mt) {
            this.main = (mt || false) && mt=="main";
            this.client = new xrpl.Client(XRPL.serverURL[this.main?"main":"test"]);
        }
        isMain(){
            return this.main;
        }
        async connect(){
            if (this.isConnected !== true){
                await this.client.connect();
                this.isConnected = true;
            }
        }
        switchServer(mt){
            if (!mt){
                mt = this.main?"test":"main";
            }
            mt = mt=="main";
            if (this.main && !mt){//we are main, we go test
                if (this.isConnected === true){
                    this.isConnected = false;
                    try { this.client.disconnect(); } catch(err){}
                }
                this.client = new xrpl.Client(XRPL.serverURL["test"]);
                this.main = false;
            } else if (!this.main && mt){//we are test, we go main
                if (this.isConnected === true){
                    this.isConnected = false;
                    try { this.client.disconnect(); } catch(err){}
                }
                this.client = new xrpl.Client(XRPL.serverURL["main"]);
                this.main = true;
            }
        }
        tryReadError(err){
            var errRet = {};
            if (err.message == "Account not found."){
                errRet.accountNotFound = true;
                errRet.errorMsg = err.message;
            } if (err.toString() == "[()]") {
                errRet.errorMsg = "Le serveur semble s'être déconnecté. Rechargez la page ou appuyez sur le bouton 'vérifiez l'adresse'.";
                this.isConnected = false;
            } else {
                errRet.errorMsg = err.toString();
            }
            return errRet;
        }
        isValidAddress(addr){
            return (addr || false) && xrpl.isValidAddress(addr);
        }
        isValidTag(tag){
            return (tag || true) && (tag.length == 0 || tag.match(/^[1-9][0-9]*$/));
        }
        #round(n){
            return Number(n.toFixed(6));
        }
        #cur40ToCur(text){
            if (text.length < XRPL.curMaxLen){ return text; }
            return text.match(/.{1,2}/g).map(function(v){
                return String.fromCharCode(parseInt(v, 16));
            }).join('').replace(/\0/g, '').toUpperCase();
        }
        #curToCur40(text){
            if (text.length == 40 || text.length == 3){ return text; }
            return text.split('').map(char_ => {
                return char_.charCodeAt(0).toString(16).padStart(2, '0');
            }).join('').padEnd(40, '0').toUpperCase();
        }
        hrCurrency(cur) {//human readable currency
            return this.#cur40ToCur(cur);
        }
        async getAccountInfo(addr){
            var account_info = await this.client.request({
                "command": "account_info",
                "account": addr,
                "ledger_index": "validated"
            });
            var server_info = await this.client.request({
                command: 'server_info',
            });
            var ownerCount = account_info.result.account_data.ownerCount || 0;
            var reserveBaseXRP = server_info.result.info.validated_ledger.reserve_base_xrp;
            var reserveIncXRP = server_info.result.info.validated_ledger.reserve_inc_xrp;
            var accountReserves =  reserveBaseXRP + ownerCount * reserveIncXRP;
            var balance = xrpl.dropsToXrp(account_info.result.account_data.Balance);
            return {
                balance : balance,
                reserve : this.#round(accountReserves),
                available : this.#round(balance-accountReserves)
            };
        }
        async getNonNativeBalances(addr, refresh){
            if (refresh || !this.assets){
                var balances = await this.client.getBalances(addr);
                this.assets = [];
                this.native = {};
                for (var bal of balances){
                    if (bal.currency === this.symbol){
                        this.native = {currency:bal.currency, balance:bal.value}
                    } else {
                        this.assets.push({currency:bal.currency, balance:bal.value, issuer:bal.issuer});
                    }
                }
            }
            return this.assets;
        }
        hasFundsLink(){
            return false;
        }
        async addFunds(addr){
            var newWallet = await this.client.fundWallet();
            var transaction = {
                TransactionType: 'Payment',
                Account: newWallet.wallet.classicAddress,
                Destination: addr,
                Amount: xrpl.xrpToDrops(9)
            };
            var trx = await this.client.autofill(transaction);
            var signedTrx = newWallet.wallet.sign(trx);
            var resp = await this.client.submitAndWait(signedTrx.tx_blob);
        }
        isValidAmount(trx){
            if (trx.asset.issuer){//non-native asset
                if (trx.amount.match(/^[1-9][0-9]*(\.[0-9]+)?$/) == null){
                    return "Le montant est mal formé";
                }
            } else {//native asset limited to 6 decimals
                if (trx.amount.match(/^[1-9][0-9]*(\.[0-9]{1,6})?$/) == null){
                    return "Il y a trop de décimales ou le montant est mal formé";
                }
            }
            if (trx.amount <= 0){
                return "Le montant doit être supérieur à 0";
            }
            if(trx.amount > Number(trx.asset.balance)){
                return "Le montant est supérieur au solde disponible";
            }
            return true;
        }
        async prepareSendTransaction(trx){
            var transaction = {
                TransactionType: 'Payment',
                Account: trx.from,
                Destination: trx.to
            }
            if (trx.asset.issuer){//case asset currency
                transaction.Amount = {
                    currency: this.#curToCur40(trx.asset.currency),
                    value: trx.amount.replace(/\.?0+$/,''),
                    issuer: trx.asset.issuer
                };
                transaction.Flags = xrpl.PaymentFlags.tfPartialPayment;
            } else {//case native
                transaction.Amount = xrpl.xrpToDrops(trx.amount);
            }
            if (trx.tag){
                transaction.DestinationTag = Number(trx.tag);
            }
            var preparedTrx = await this.client.autofill(transaction);
            preparedTrx.LastLedgerSequence = preparedTrx.LastLedgerSequence+XRPL.LLIAdd;
            return {
                from : preparedTrx.Account,
                to : preparedTrx.Destination,
                currency : preparedTrx.Amount.currency?this.#cur40ToCur(preparedTrx.Amount.currency):this.symbol,
                amount : preparedTrx.Amount.value?preparedTrx.Amount.value:xrpl.dropsToXrp(preparedTrx.Amount),
                fee : xrpl.dropsToXrp(preparedTrx.Fee),
                tag : preparedTrx.DestinationTag,
                preparedTransaction : preparedTrx
            }
        }
        checkCurrency(cur){
            if (cur === this.symbol){
                return { error : "La devise renseignée ne peut pas être "+this.symbol };
            }
            if (cur.length != 3 && cur.length != 40){
                if (cur.length < 2){
                    return { error : "La devise renseignée doit avoir au moins 2 caractères" };
                } else if (cur.length > XRPL.curMaxLen && cur.length != 40){
                    return { error : "La devise renseignée doit être un code court ou 40 caractères en hexadecimal" };
                } else {
                    return { currency : this.#curToCur40(cur) };
                }
            }
            return { currency : cur };
        }
        isValidMax(max){
            return (max || false) && max.match(/^[1-9][0-9]+$/);
        }
        async prepareTrustSet(trx){
            var transaction = {
                TransactionType: "TrustSet",
                Account: trx.from,
                LimitAmount : {
                    currency: trx.currency,
                    issuer: trx.issuer,
                    value: trx.max
                }
            }
            if (trx.type == "revoke"){
                transaction.Flags = xrpl.TrustSetFlags.tfClearFreeze | xrpl.TrustSetFlags.tfSetNoRipple;
            }
            var preparedTrx = await this.client.autofill(transaction);
            preparedTrx.LastLedgerSequence = preparedTrx.LastLedgerSequence+XRPL.LLIAdd;
            return {
                from : preparedTrx.Account,
                issuer : preparedTrx.LimitAmount.issuer,
                currency : this.#cur40ToCur(preparedTrx.LimitAmount.currency),
                max : preparedTrx.LimitAmount.value,
                fee : xrpl.dropsToXrp(preparedTrx.Fee),
                preparedTransaction : preparedTrx
            }
        }
        async prepareDeleteAccount(trx){
            var transaction = {
                TransactionType: 'AccountDelete',
                Account: trx.from,
                Destination: trx.to
            }
            if (trx.tag){
                transaction.DestinationTag = parseInt(trx.tag);
            }
            var preparedTrx = await this.client.autofill(transaction);
            preparedTrx.LastLedgerSequence = preparedTrx.LastLedgerSequence+XRPL.LLIAdd;
            return {
                from : preparedTrx.Account,
                to : preparedTrx.Destination,
                fee : xrpl.dropsToXrp(preparedTrx.Fee),
                tag : preparedTrx.DestinationTag,
                preparedTransaction : preparedTrx
            }
        }
        async getSignersList(addr){
            var account_info = await this.client.request({
                "command": "account_info",
                "account": addr,
                "ledger_index": "validated",
                "signer_lists":true
            });
            return {
                signers : account_info.result.signer_lists.length==0?[]:[account_info.result.signer_lists[0].SignerEntries[0].SignerEntry.Account],
                masterDisabled : account_info.result.account_flags.disableMasterKey
            };
        }
        async prepareSigners(action, addr, signer){
            var transaction;
            switch(action){
                case "set":
                    transaction = {
                        TransactionType: 'SignerListSet',
                        Account: addr,
                        SignerQuorum: 1,
                        SignerEntries: [
                            {SignerEntry:{Account:signer,SignerWeight:1}}//,...
                        ]
                    };
                    break;
                case "del":
                    transaction = {
                        TransactionType: 'SignerListSet',
                        Account: addr,
                        SignerQuorum: 0
                    };
                    break;
                case "enable":
                    transaction = {
                        TransactionType: 'AccountSet',
                        Account: addr,
                        ClearFlag:xrpl.AccountSetAsfFlags.asfDisableMaster
                    };
                    break;
                case "disable":
                    transaction = {
                        TransactionType: 'AccountSet',
                        Account: addr,
                        SetFlag:xrpl.AccountSetAsfFlags.asfDisableMaster
                    };
                    break;
                default:
                    return false;
            }
            var preparedTrx = await this.client.autofill(transaction);
            preparedTrx.LastLedgerSequence = preparedTrx.LastLedgerSequence+XRPL.LLIAdd;
            return {
                from : preparedTrx.Account,
                fee : xrpl.dropsToXrp(preparedTrx.Fee),
                signer : signer,
                preparedTransaction : preparedTrx
            }
        }
    },
    //------------------------------------- XLM -------------------------------------------
    "XLM": class XLM {
        static serverURL = { "main":"https://horizon.stellar.org", "test":"https://horizon-testnet.stellar.org"};
        static isLibLoaded(){
            return !(typeof StellarSdk === "undefined");
        }
        static TRXTimeout = 240;//delay in second to add as a timeout of the transaction to ensure we have time to do the transaction with USB key
        symbol = "XLM";
        constructor(mt) {
            this.main = (mt || false) && mt=="main";
            this.server = new StellarSdk.Horizon.Server(XLM.serverURL[this.main?"main":"test"]);
        }
        isMain(){
            return this.main;
        }
        async connect(){
            this.isConnected = true;
        }
        switchServer(mt){
            if (!mt){
                mt = this.main?"test":"main";
            }
            mt = mt=="main";
            if (this.main && !mt){//we are main, we go test
                this.server = new StellarSdk.Horizon.Server(XLM.serverURL["test"]);
                this.main = false;
            } else if (!this.main && mt){//we are test, we go main
                this.server = new StellarSdk.Horizon.Server(XLM.serverURL["main"]);
                this.main = true;
            }
        }
        tryReadError(err){
            var errRet = {};
            if (err.message == "Not Found"){
                errRet.accountNotFound = true;
                errRet.errorMsg = "Account not found";
            } else if (err.response && err.response.data && err.response.data.extras && err.response.data.extras.result_codes && err.response.data.extras.result_codes){
                errRet.errorMsg = err.toString()+" - Reason : <br/>"+JSON.stringify(err.response.data.extras.result_codes,null, 3);
            } else {
                errRet.errorMsg = err.toString();
            }
            return errRet;
        }
        isValidAddress(addr){
            return (addr || false) && StellarSdk.StrKey.isValidEd25519PublicKey(addr);
        }
        isValidTag(tag){
            return (tag || true) && tag.match(/^[A-Za-z0-9]*$/);
        }
        hrCurrency(cur) {//human readable currency
            return cur;
        }
        #round(n){
            return Number(n.toFixed(7));
        }
        async getAccountInfo(addr){
            this.accountAddr = addr;
            var account_info = await this.server.loadAccount(addr);
            this.assets = [];
            this.native = {};
            for (var asset of account_info.balances){
                if (asset.asset_type === "native"){
                    this.native = {currency:"XLM", balance:asset.balance};
                } else {
                    this.assets.push({currency:asset.asset_code, balance:asset.balance, issuer:asset.asset_issuer});
                }
            }
            var baseReserve = 0.5;//TODO get from blockchain, but where ?
            var reserve = baseReserve*(2+account_info.subentry_count);
            return {
                balance : this.native.balance,
                reserve : this.#round(reserve),
                available : this.#round(this.native.balance-reserve)
            };
        }
        async getNonNativeBalances(addr, refresh){
            if (refresh){
                await this.getAccountInfo(addr);
            }
            return this.assets;
        }
        hasFundsLink(){
            return "https://lab.stellar.org/account/fund";
        }
        async addFunds(addr){}
        isValidAmount(trx){
            if (trx.asset.issuer){//non-native asset
                if (trx.amount.match(/^[1-9][0-9]*(\.[0-9]+)?$/) == null){
                    return "Le montant est mal formé";
                }
            } else {//native asset limited to 7 decimals
                if (trx.amount.match(/^[1-9][0-9]*(\.[0-9]{1,7})?$/) == null){
                    return "Il y a trop de décimales ou le montant est mal formé";
                }
            }
            if (trx.amount <= 0){
                return "Le montant doit être supérieur à 0";
            }
            if(trx.amount > Number(trx.asset.balance)){
                return "Le montant est supérieur au solde disponible";
            }
            return true;
        }
        async prepareSendTransaction(trx){
            var destAccountExists = false;
            try {
                await this.server.loadAccount(trx.to);
                destAccountExists = true;
            } catch(err){
                if (err.message!="Not Found"){
                    console.error(err);
                }
            }
            const account = await this.server.loadAccount(trx.from);
            var ope;
            if (destAccountExists){
                ope = StellarSdk.Operation.payment({
                    destination: trx.to,
                    asset: trx.asset.issuer?new StellarSdk.Asset(trx.asset.currency,trx.asset.issuer):StellarSdk.Asset.native(),
                    amount : trx.amount,
                });
            } else {
                ope = StellarSdk.Operation.createAccount({
                    destination: trx.to,
                    startingBalance: trx.amount,
                });
            }
            const ntws = this.isMain()?StellarSdk.Networks.PUBLIC:StellarSdk.Networks.TESTNET;
            const fee = await this.server.fetchBaseFee();
            var preparedTrx = new StellarSdk.TransactionBuilder(account, { fee, networkPassphrase: ntws })
                .addOperation(ope)
                .setTimeout(XLM.TRXTimeout);
            if (trx.tag){
                preparedTrx = preparedTrx.addMemo(StellarSdk.Memo.text(trx.tag));
            }
            preparedTrx = preparedTrx.build().toXDR();
            var check = StellarSdk.TransactionBuilder.fromXDR(preparedTrx,ntws);
            return {
                from : check._source,
                to : check._operations[0].destination,
                currency : destAccountExists?check._operations[0].asset.code:this.symbol,
                amount : destAccountExists?check._operations[0].amount.replace(/\.?0+$/,''):check._operations[0].startingBalance.replace(/\.?0+$/,''),
                fee : (check._fee/Math.pow(10,7)).toFixed(7).replace(/0+$/,''),
                tag : check._memo._value?(new TextDecoder().decode(check._memo._value)):check._memo._value,
                preparedTransaction : {
                    "XDR" : preparedTrx,
                    "Network" : ntws
                }
            }
        }
        checkCurrency(cur){
            if (cur === this.symbol){
                return { error : "La devise renseignée ne peut pas être "+this.symbol };
            }
            if (cur.length < 2){
                return { error : "La devise renseignée doit avoir au moins 2 caractères" };
            }
            return { currency : cur };
        }
        isValidMax(max){
            return (max || false) && max.match(/^[1-9][0-9]+$/);
        }
        async prepareTrustSet(trx){
            const account = await this.server.loadAccount(trx.from);
            const ntws = this.isMain()?StellarSdk.Networks.PUBLIC:StellarSdk.Networks.TESTNET;
            const fee = await this.server.fetchBaseFee();
            var preparedTrx = new StellarSdk.TransactionBuilder(account, { fee, networkPassphrase: ntws })
                .addOperation(StellarSdk.Operation.changeTrust({
                    asset: new StellarSdk.Asset(trx.currency,trx.issuer),
                    limit: trx.type=="revoke"?"0":trx.max
                }))
                .setTimeout(XLM.TRXTimeout);
            preparedTrx = preparedTrx.build().toXDR();
            var check = StellarSdk.TransactionBuilder.fromXDR(preparedTrx,ntws);
            return {
                from : check._source,
                issuer : check._operations[0].line.issuer,
                currency : check._operations[0].line.code,
                max : check._operations[0].limit.replace(/\.?0+$/,''),
                fee : (check._fee/Math.pow(10,7)).toFixed(7).replace(/0+$/,''),
                preparedTransaction : {
                    "XDR" : preparedTrx,
                    "Network" : ntws
                }
            }
        }
        async prepareDeleteAccount(trx){
            const account = await this.server.loadAccount(trx.from);
            const ntws = this.isMain()?StellarSdk.Networks.PUBLIC:StellarSdk.Networks.TESTNET;
            const fee = await this.server.fetchBaseFee();
            var preparedTrx = new StellarSdk.TransactionBuilder(account, { fee, networkPassphrase: ntws })
                .addOperation(StellarSdk.Operation.accountMerge({
                    destination: trx.to
                }))
                .setTimeout(XLM.TRXTimeout);
            if (trx.tag){
                preparedTrx = preparedTrx.addMemo(StellarSdk.Memo.text(trx.tag));
            }
            preparedTrx = preparedTrx.build().toXDR();
            var check = StellarSdk.TransactionBuilder.fromXDR(preparedTrx,ntws);
            return {
                from : check._source,
                to : check._operations[0].destination,
                fee : (check._fee/Math.pow(10,7)).toFixed(7).replace(/0+$/,''),
                tag : check._memo._value?(new TextDecoder().decode(check._memo._value)):check._memo._value,
                preparedTransaction : {
                    "XDR" : preparedTrx,
                    "Network" : ntws
                }
            }
        }
        async getSignersList(addr){
            var account_info = await this.server.loadAccount(addr);
            var masterSigner,signers=[];
            for (var i=0;i<account_info.signers.length;i++){
                if (account_info.signers[i].key === this.accountAddr){
                    masterSigner = account_info.signers[i];
                } else {
                    signers.push(account_info.signers[i]);
                }
            }
            return {
                signers : signers.length==0?[]:signers.map(function(s){return s.key;}),
                masterDisabled : masterSigner.weight==0
            };
        }
        async prepareSigners(action, addr, signer){
            const account = await this.server.loadAccount(addr);
            const ntws = this.isMain()?StellarSdk.Networks.PUBLIC:StellarSdk.Networks.TESTNET;
            const fee = await this.server.fetchBaseFee();
            var options;
            switch(action){
                case "set":
                case "del":
                    options = {
                        signer : {
                            ed25519PublicKey:signer,
                            weight:action==="set"?1:0
                        }
                    };
                    break;
                case "enable":
                    options = {
                        masterWeight:1
                    };
                    break;
                case "disable":
                    if (account.signers.length > 1){
                        options = {
                            masterWeight:0
                        };
                    } else {
                        return false;//security : do not del master if no signer exists
                    }
                    break;
                default:
                    return false;
            }
            var preparedTrx = new StellarSdk.TransactionBuilder(account, { fee, networkPassphrase: ntws })
                .addOperation(StellarSdk.Operation.setOptions(options))
                .setTimeout(XLM.TRXTimeout);
            preparedTrx = preparedTrx.build().toXDR();
            var check = StellarSdk.TransactionBuilder.fromXDR(preparedTrx,ntws);
            return {
                from : check._source,
                fee : (check._fee/Math.pow(10,7)).toFixed(7).replace(/0+$/,''),
                signer : signer,
                preparedTransaction : {
                    "XDR" : preparedTrx,
                    "Network" : ntws
                }
            }
        }
    }
};

// ===== GLOBAL VARIABLES =====
let NETWORK;
const _online_ = {};

// ===== THEME MANAGEMENT =====
function setTheme(networkType, serverType = 'main') {
    const body = document.body;
    
    // Remove existing theme classes
    body.className = body.className.replace(/\b(xrpl|xlm|mainnet|testnet)-theme\b/g, '');
    
    // Add blockchain theme
    body.classList.add(`${networkType.toLowerCase()}-theme`);
    
    // Add network theme
    body.classList.add(`${serverType === 'main' ? 'mainnet' : 'testnet'}-theme`);
    
    // Update currency watermark - XRP pour XRPL, XLM pour XLM
    const currencySymbol = networkType === 'XRPL' ? 'XRP' : 'XLM';
    $('.cur').text(currencySymbol);
    $('.currency-watermark .cur').text(currencySymbol);
}

// ===== NETWORK MANAGEMENT =====
function initializeNetwork(networkType, serverType) {
    const _class_ = CLASSES[networkType];
    if (_class_.isLibLoaded()) {
        NETWORK = new _class_(serverType);
        
        // Set theme with both blockchain and network
        setTheme(networkType, serverType);
        
        // Update UI elements
        $('#addFundsBtn').hide();
        $('#d_nowWhat').hide();
        // $('#d_accountValid').css('visibility', 'hidden');
        $('#d_accountValid').css('display', 'none').css('visibility', 'hidden');
        $('#libCompromised').hide();
        
        // Update currency symbols everywhere
        const currencySymbol = NETWORK.symbol;
        $('.cur').text(currencySymbol);
        $('#amount').attr('placeholder', `Montant en ${currencySymbol}`);
        $('.main-container').show();
        
        // Update tutorial link
        const tutorialLinks = {
            'XRPL': 'https://youtu.be/djt5ZKKJrWI',
            'XLM': 'https://youtu.be/CJpHtLly6n4'
        };
        $('#tuto-video').attr('href', tutorialLinks[networkType]);
        
    } else {
        $('#libCompromised span').text(networkType);
        $('#libCompromised').show();
        $('.main-container').hide();
    }
}

// ===== UTILITY FUNCTIONS =====
function setErr($e, msg, $parentIfNotStandard) {
    $e.addClass("is-invalid");
    $('.invalid-feedback', $parentIfNotStandard ? $parentIfNotStandard : $e.parent()).html(msg).show();
}

function clearErr($e, $parentIfNotStandard) {
    $e.removeClass("is-invalid");
    $('.invalid-feedback', $parentIfNotStandard ? $parentIfNotStandard : $e.parent()).hide();
}

function shortenAddr(addr) {
    return addr.substr(0, 4) + "..." + addr.substr(addr.length - 4);
}

function showLoading($button, text = '') {
    $button.prepend('<span class="spinner-grow spinner-grow-sm"></span> ')
           .attr('disabled', 'true');
    if (text) {
        $button.find('.spinner-grow').after(text);
    }
}

function hideLoading($button) {
    $button.find('.spinner-grow').remove();
    $button.removeAttr('disabled');
}

// ===== MAIN FUNCTIONS =====
_online_.viewDetails = async function(refresh) {
    const $checkAddrBtn = $("#checkAddrBtn");
    const $fromAddr = $('#accountAddr');
    clearErr($fromAddr);
    const addr = $('#accountAddr').val().trim();
    
    if (!NETWORK.isValidAddress(addr)) {
        setErr($fromAddr, "L'adresse fournie semble être mal formée");
        return;
    }
    
    if (!refresh) {
        $('.nav-link').removeClass('active');
        $('.tab-pane').removeClass("active show");
    }
    
    $('#addFundsBtn').hide();
    
    try {
        showLoading($checkAddrBtn);
        await NETWORK.connect();
        
        const accountInfo = await NETWORK.getAccountInfo(addr);
        $('#s_balance').text(accountInfo.balance);
        $('#s_reserves').text(accountInfo.reserve);
        $('#s_available').text(accountInfo.available);
        // $('#d_accountValid').css('visibility', 'visible');
        $('#d_accountValid').css('display', 'block').css('visibility', 'visible');
        $('#d_nowWhat').show();
        
        // Get price in USD
        try {
            const response = await fetch(`https://api.bitget.com/api/v2/spot/market/tickers?symbol=${NETWORK.symbol}USDT`);
            const data = await response.json();
            const usdValue = (data.data[0].lastPr * Number(accountInfo.balance)).toFixed(2);
            $('#dollarAmount').html(` / <strong>( ${usdValue}$ )</strong>`);
        } catch (error) {
            console.log("Could not fetch USD price");
        }
        
        // Get non-native assets
        try {
            $('#d_accountValid .alert ul.list-group').remove();
            const $newUL = $('<ul class="list-group mt-2"><h6><a href="javascript:;" onClick="$(\'#d_accountValid .alert ul.list-group div\').toggle()">Autres assets</a> :</h6><div style="display:none;"></div></ul>');
            const balances = await NETWORK.getNonNativeBalances(addr);
            
            for (const bal of balances) {
                $('div', $newUL).append(`
                    <li class="list-group-item list-group-item-light d-flex justify-content-between align-items-center">
                        ${NETWORK.hrCurrency(bal.currency)}
                        <span class="badge text-bg-primary rounded-pill">${bal.balance}</span>
                    </li>
                `);
            }
            
            if (balances.length > 0) {
                $('#d_accountValid .alert').append($newUL);
            }
        } catch (error) {
            console.error(NETWORK.tryReadError(error));
        }
        
    } catch (error) {
        const err = NETWORK.tryReadError(error);
        if (err.accountNotFound) {
            setErr($fromAddr, "Ce compte n'existe pas encore sur la blockchain. Ajoutez des fonds d'abord.");
            if (!NETWORK.isMain()) {
                $('#addFundsBtn').show();
            }
        } else {
            console.error(err);
            setErr($fromAddr, `Il y a sûrement une erreur dans l'adresse de votre compte : <strong>${err.errorMsg}</strong>`);
        }
        $('#d_accountValid').css('visibility', 'hidden');
        $('#d_nowWhat').hide();
    } finally {
        hideLoading($checkAddrBtn);
    }
};

_online_.addFunds = async function() {
    if (NETWORK.hasFundsLink()) {
        window.open(NETWORK.hasFundsLink(), '_blank').focus();
    } else {
        const $fromAddr = $('#accountAddr');
        const addr = $fromAddr.val().trim();
        
        try {
            setErr($fromAddr, "Envoi de fonds vers votre wallet, veuillez patienter...");
            showLoading($('#addFundsBtn'));
            await NETWORK.addFunds(addr);
            setErr($fromAddr, "Envoi effectué avec succès...");
            await _online_.viewDetails();
            $('#addFundsBtn').hide();
        } catch (err) {
            err = NETWORK.tryReadError(err);
            console.error(err);
            setErr($fromAddr, `Erreur lors de l'ajout des fonds : <strong>${err.errorMsg}</strong>`);
        } finally {
            hideLoading($('#addFundsBtn'));
        }
    }
};

_online_.sendFundsPrepare = async function(refresh) {
    if (refresh) {
        await _online_.viewDetails(refresh);
    }
    
    const $sendSelectCur = $('#sendSelectCur');
    const addr = $('#accountAddr').val().trim();
    
    $sendSelectCur.empty().append(`<option value="${NETWORK.symbol}" selected>${NETWORK.symbol} (max:${$('#s_available').text()})</option>`);
    
    try {
        const assets = await NETWORK.getNonNativeBalances(addr, refresh);
        _online_.sendCurList = {};
        
        for (const a of assets) {
            if (a.balance > 0) {
                const cur = NETWORK.hrCurrency(a.currency);
                _online_.sendCurList[cur] = a;
                $sendSelectCur.append(`<option value="${cur}">${cur} (max:${a.balance})</option>`);
            }
        }
        
        $sendSelectCur.off('change').on('change', function() {
            $('#amount').attr('placeholder', `Montant en ${this.value}`);
        });
    } catch (error) {
        console.error(NETWORK.tryReadError(error));
    }
};

_online_.max = function() {
    if (_online_.sendCurList && _online_.sendCurList[$('#sendSelectCur').val()]) {
        $('#amount').val(_online_.sendCurList[$('#sendSelectCur').val()].balance);
    } else {
        $('#amount').val($('#s_available').text());
    }
};

_online_.prepareSend = async function() {
    const $destAddr = $('#destAddr');
    clearErr($destAddr);
    const $famount = $('#amount');
    clearErr($famount, $famount.parent().parent());
    const $ftag = $('#destTag');
    clearErr($ftag);
    let hasError = false;
    
    const addr = $('#accountAddr').val().trim();
    const dest = $destAddr.val().trim();
    
    if (!NETWORK.isValidAddress(dest)) {
        setErr($destAddr, "L'adresse de destination fournie semble être mal formée");
        hasError = true;
    }
    
    const tag = $ftag.val().trim();
    if (!NETWORK.isValidTag(tag)) {
        setErr($ftag, "Le tag/memo est incorrect");
        hasError = true;
    }
    
    const amount = $famount.val().trim();
    const trxDetails = {
        from: addr,
        to: dest,
        amount: amount
    };
    
    if (_online_.sendCurList && _online_.sendCurList[$('#sendSelectCur').val()]) {
        trxDetails.asset = _online_.sendCurList[$('#sendSelectCur').val()];
    } else {
        trxDetails.asset = {currency: NETWORK.symbol, balance: $('#s_available').text()};
    }
    
    if (NETWORK.isValidAmount(trxDetails) !== true) {
        setErr($famount, NETWORK.isValidAmount(trxDetails), $famount.parent().parent());
        hasError = true;
    }
    
    if (hasError) {
        return;
    }
    
    if (tag.length > 0) {
        trxDetails.tag = tag;
    }
    
    try {
        const $prepTrxBut = $("#prepareTrxBtn");
        $('.invalid-feedback', $prepTrxBut.parent()).hide();
        showLoading($prepTrxBut);
        
        const prepedTrx = await NETWORK.prepareSendTransaction(trxDetails);
        $('#trxResult').val(JSON.stringify(prepedTrx.preparedTransaction, null, 3));
        
        $("#recap-trx").html(`
            <strong>Transfert:</strong> 
            <span class="badge text-bg-secondary">${shortenAddr(prepedTrx.from)}</span> 
            ➞ 
            <span class="badge text-bg-secondary">${shortenAddr(prepedTrx.to)}${prepedTrx.tag ? ' (' + prepedTrx.tag + ')' : ''}</span> 
            de <span class="badge text-bg-info">${prepedTrx.amount} ${prepedTrx.currency}</span> 
            + Frais : <span class="badge text-bg-warning">${prepedTrx.fee} ${NETWORK.symbol}</span>
        `);
        
        $('#trxResultModal').modal('show');
        $('#dwnldButton').off('click').on('click', function() {
            _online_.download(`Send_${prepedTrx.amount}_${prepedTrx.currency}`);
        });
        
    } catch (error) {
        error = NETWORK.tryReadError(error);
        console.error(error);
        $('.invalid-feedback', $prepTrxBut.parent()).html(`Une erreur est survenue : <strong>${error.errorMsg}</strong>`).show();
    } finally {
        hideLoading($prepTrxBut);
    }
};

_online_.trustList = async function() {
    const addr = $('#accountAddr').val().trim();
    const $trustSelect = $('#trustlist select');
    
    $('#trustlist .input-group').hide();
    $('#trustlist .text-danger').hide();
    $('#trustlist .text-warning').hide();
    $('#trustlist .text-primary').html('<span class="spinner-grow spinner-grow-sm"></span> Recherche des trustlines en cours...').show();
    $('#trustlist').show();
    
    try {
        const assets = await NETWORK.getNonNativeBalances(addr, true);
        
        if (assets.length == 0) {
            $('#trustlist .text-danger').html("Il n'y a pas de trustline sur ce compte").show();
            $('#trustlist .text-primary').hide();
        } else {
            $trustSelect.empty().append('<option selected>Sélectionnez la trustline à révoquer</option>');
            _online_.trustlist = {};
            
            for (const a of assets) {
                if (a.balance == 0) {
                    _online_.trustlist[a.issuer] = a;
                    $trustSelect.append(`<option value="${a.issuer}">${NETWORK.hrCurrency(a.currency)} (${a.issuer})</option>`);
                }
            }
            
            $trustSelect.off('change').on('change', function() {
                if (!_online_.trustlist[this.value]) {
                    $('#prepareTrustBtn').prop('disabled', true);
                } else if (_online_.trustlist[this.value].balance > 0) {
                    $('#trustlist .text-warning').show();
                    $('#prepareTrustBtn').prop('disabled', true);
                } else {
                    $('#trustlist .text-warning').hide();
                    $('#prepareTrustBtn').prop('disabled', false);
                }
            });
            
            $('#trustlist .input-group').show();
            $('#trustlist .text-primary').html('Veuillez choisir la trustline à révoquer:').show();
        }
    } catch (error) {
        error = NETWORK.tryReadError(error);
        $('#trustlist .text-primary').hide();
        console.error(error);
        $('#trustlist .text-danger').html(`Une erreur est survenue : <strong>${error.errorMsg}</strong>`).show();
    }
};

_online_.prepareTrustSet = async function() {
    const trustRBVal = $('input[name="trustSetRB"]:checked').val();
    const trxDetails = {
        from: $('#accountAddr').val().trim()
    };
    
    if (trustRBVal == "set") {
        const $fissuer = $('#asset_issuer');
        clearErr($fissuer);
        const $fcur = $('#asset_currency');
        clearErr($fcur);
        const $fmax = $('#asset_max');
        clearErr($fmax);
        let hasError = false;
        
        const issuer = $fissuer.val().trim();
        const currency = $fcur.val().trim().toUpperCase();
        const max = $fmax.val().trim();
        
        if (!NETWORK.isValidAddress(issuer)) {
            setErr($fissuer, "L'adresse du fournisseur semble être mal formée");
            hasError = true;
        }
        
        const curCheck = NETWORK.checkCurrency(currency);
        if (curCheck.error) {
            setErr($fcur, curCheck.error);
            hasError = true;
        }
        
        if (!NETWORK.isValidMax(max)) {
            setErr($fmax, "La valeur max renseignée n'est pas correcte");
            hasError = true;
        }
        
        if (hasError) {
            return;
        }
        
        $.extend(trxDetails, {
            type: "add",
            issuer: issuer,
            currency: curCheck.currency,
            max: max
        });
    } else {
        const trustSelectVal = _online_.trustlist[$('#trustlist select').val()];
        $.extend(trxDetails, {
            type: "revoke",
            currency: trustSelectVal.currency,
            issuer: trustSelectVal.issuer,
            max: "0"
        });
    }
    
    try {
        const $prepareTrustBtn = $("#prepareTrustBtn");
        $('.invalid-feedback', $prepareTrustBtn.parent()).hide();
        showLoading($prepareTrustBtn);
        
        const prepedTrx = await NETWORK.prepareTrustSet(trxDetails);
        $('#trxResult').val(JSON.stringify(prepedTrx.preparedTransaction, null, 3));
        
        $("#recap-trx").html(`
            <strong>${trustRBVal == "set" ? 'Ajout de' : 'Révocation de'}</strong> 
            <span class="badge text-bg-primary">${prepedTrx.currency}</span> - 
            Sur : <span class="badge text-bg-secondary">${shortenAddr(prepedTrx.from)}</span> - 
            Issuer : <span class="badge text-bg-secondary">${shortenAddr(prepedTrx.issuer)}</span> 
            ${trustRBVal == "set" ? 'max : <span class="badge text-bg-info">' + prepedTrx.max + '</span>' : ''} 
            + Frais : <span class="badge text-bg-warning">${prepedTrx.fee} ${NETWORK.symbol}</span>
        `);
        
        $('#trxResultModal').modal('show');
        $('#dwnldButton').off('click').on('click', function() {
            _online_.download((trustRBVal == "set" ? "SetTrust_" : "DelTrust_") + prepedTrx.currency);
        });
        
    } catch (error) {
        error = NETWORK.tryReadError(error);
        console.error(error);
        $('.invalid-feedback', $prepareTrustBtn.parent()).html(`Une erreur est survenue : <strong>${error.errorMsg}</strong>`).show();
    } finally {
        hideLoading($prepareTrustBtn);
    }
};

_online_.deleteAccoutTabClicked = async function() {
    const addr = $('#accountAddr').val().trim();
    const assets = await NETWORK.getNonNativeBalances(addr, true);
    
    if (assets.length > 0) {
        $('#delete-account-assets').show();
        $('#deleteAccountBtn').attr('disabled', 'true');
    } else {
        $('#delete-account-assets').hide();
        $('#deleteAccountBtn').removeAttr('disabled');
    }
};

_online_.prepareDeleteAccount = async function() {
    const $addr = $('#accountAddr');
    const $destRelAddr = $('#destRelAddr');
    clearErr($destRelAddr);
    const $rtag = $('#destRelTag');
    clearErr($rtag);
    let hasError = false;
    
    const addr = $addr.val().trim();
    const destRelAddr = $destRelAddr.val().trim();
    
    if (!NETWORK.isValidAddress(destRelAddr)) {
        setErr($destRelAddr, "L'adresse de destination fournie semble être mal formée");
        hasError = true;
    }
    
    const trxDetails = {
        from: addr,
        to: destRelAddr
    };
    
    const tag = $rtag.val().trim();
    if (!NETWORK.isValidTag(tag)) {
        setErr($rtag, "Le tag/memo est incorrect");
        hasError = true;
    }
    
    if (hasError) {
        return;
    }
    
    if (tag.length > 0) {
        trxDetails.tag = tag;
    }
    
    try {
        const $prepareDelBtn = $("#deleteAccountBtn");
        $('.invalid-feedback', $prepareDelBtn.parent()).hide();
        showLoading($prepareDelBtn);
        
        const prepedTrx = await NETWORK.prepareDeleteAccount(trxDetails);
        $('#trxResult').val(JSON.stringify(prepedTrx.preparedTransaction, null, 3));
        
        $("#recap-trx").html(`
            <strong>Suppression du compte</strong> 
            <span class="badge text-bg-primary">${shortenAddr(prepedTrx.from)}</span> - 
            Reliquat de ${NETWORK.symbol} envoyé à : 
            <span class="badge text-bg-secondary">${shortenAddr(prepedTrx.to)}${prepedTrx.tag ? ' (' + prepedTrx.tag + ')' : ''}</span> 
            + Frais : <span class="badge text-bg-warning">${prepedTrx.fee} ${NETWORK.symbol}</span>
        `);
        
        $('#trxResultModal').modal('show');
        $('#dwnldButton').off('click').on('click', function() {
            _online_.download(`Del_${shortenAddr(prepedTrx.from)}`);
        });
        
    } catch (error) {
        error = NETWORK.tryReadError(error);
        console.error(error);
        $('.invalid-feedback', $prepareDelBtn.parent()).html(`Une erreur est survenue : <strong>${error.errorMsg}</strong>`).show();
    } finally {
        hideLoading($prepareDelBtn);
    }
};

_online_.setSignersTabClicked = async function() {
    const $addr = $('#accountAddr');
    const addr = $addr.val().trim();
    
    const $button = $("#b_signers_reload");
    showLoading($button);
    
    try {
        const signer_info = await NETWORK.getSignersList(addr);
        
        $('#d_signers_masteronoff').show();
        
        if (signer_info.masterDisabled) {
            $('#b_signers_master_off').hide();
            $('#b_signers_master_on').show();
            $('#signer_masterActive').attr('class', 'badge text-bg-danger').text('DÉSACTIVÉ');
        } else {
            if (signer_info.signers.length > 0) {
                $('#b_signers_master_off').show();
            } else {
                $('#b_signers_master_off').hide();
                $('#d_signers_masteronoff').hide();
            }
            $('#b_signers_master_on').hide();
            $('#signer_masterActive').attr('class', 'badge text-bg-success').text('ACTIF');
        }
        
        if (signer_info.signers.length > 0) {
            $('#signer_addr').val(signer_info.signers[0]);
            if (!signer_info.masterDisabled) {
                $('#d_signers_del').show();
            } else {
                $('#d_signers_del').hide();
            }
            $('#signer_signerAddr').attr('class', 'badge text-bg-primary').html(
                signer_info.signers.map(function(s) {
                    return `<strong>${s.substr(0, 4)}</strong><span style="color:#bbb;">${s.substr(4, s.length - 8)}</span><strong>${s.substr(s.length - 4)}</strong>`;
                }).join(",<br/>")
            );
        } else {
            $('#signer_addr').val("");
            $('#d_signers_del').hide();
            $('#signer_signerAddr').attr('class', 'badge text-bg-secondary').text("Indéfini");
        }
        
    } catch (error) {
        console.error(NETWORK.tryReadError(error));
    } finally {
        hideLoading($button);
    }
};

_online_.prepareSigners = async function(action) {
    const $addr = $('#accountAddr');
    const addr = $addr.val().trim();
    
    const $signerAddr = $('#signer_addr');
    const signerAddr = $signerAddr.val();
    clearErr($signerAddr);
    
    let $button, prepedTrxFund, filenamePrefix, command;
    
    switch (action) {
        case "set":
            if (!NETWORK.isValidAddress(signerAddr)) {
                setErr($signerAddr, "L'adresse du signataire fournie semble être mal formée");
                return;
            }
            $button = $("#b_signers_set");
            filenamePrefix = "SignerSet_";
            command = "Définir signataire de ";
            prepedTrxFund = async function() { return await NETWORK.prepareSigners(action, addr, signerAddr) };
            break;
        case "del":
            if (!NETWORK.isValidAddress(signerAddr)) {
                setErr($signerAddr, "L'adresse du signataire fournie semble être mal formée");
                return;
            }
            $button = $("#b_signers_del");
            filenamePrefix = "SignerDel_";
            command = "Supprimer signataire de ";
            prepedTrxFund = async function() { return await NETWORK.prepareSigners(action, addr, signerAddr) };
            break;
        case "enable":
            $button = $("#b_signers_master_on");
            filenamePrefix = "MasterOn_";
            command = "Activer clé maître sur ";
            prepedTrxFund = async function() { return await NETWORK.prepareSigners(action, addr) };
            break;
        case "disable":
            $button = $("#b_signers_master_off");
            filenamePrefix = "MasterOff_";
            command = "Désactiver clé maître sur ";
            prepedTrxFund = async function() { return await NETWORK.prepareSigners(action, addr) };
            break;
        default:
            return;
    }
    
    try {
        $('.invalid-feedback', $button.parent()).hide();
        showLoading($button);
        
        const prepedTrx = await prepedTrxFund();
        
        if (prepedTrx === false) {
            $('.invalid-feedback', $button.parent()).html("Impossible de réaliser cette opération, car elle pourrait compromettre l'accès à ce compte").show();
        } else {
            $('#trxResult').val(JSON.stringify(prepedTrx.preparedTransaction, null, 3));
            
            $("#recap-trx").html(`
                <strong>${command}</strong> 
                <span class="badge text-bg-primary">${shortenAddr(prepedTrx.from)}</span>
                ${action == "set" ? ' - Signataire : <span class="badge text-bg-secondary">' + shortenAddr(prepedTrx.signer) + '</span>' : ''} 
                + Frais : <span class="badge text-bg-warning">${prepedTrx.fee} ${NETWORK.symbol}</span>
            `);
            
            $('#trxResultModal').modal('show');
            $('#dwnldButton').off('click').on('click', function() {
                _online_.download(filenamePrefix + shortenAddr(addr));
            });
            $('#b_signers_reload').show();
        }
        
    } catch (error) {
        error = NETWORK.tryReadError(error);
        console.error(error);
        $('.invalid-feedback', $button.parent()).html(`Une erreur est survenue : <strong>${error.errorMsg}</strong>`).show();
    } finally {
        hideLoading($button);
    }
};

_online_.download = function(prefix) {
    const a = document.createElement('a');
    const file = new Blob([$('#trxResult').val()], { type: 'application/json' });
    a.href = URL.createObjectURL(file);
    a.download = `#${new Date().getTime() % 1000}_${prefix}-${NETWORK.constructor.name}-${NETWORK.isMain() ? "main" : "test"}.tosign.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

_online_.copy = function() {
    const textarea = $('#trxResult');
    textarea.select();
    try {
        document.execCommand('copy');
        $('#copyBtn .badge').show();
        setTimeout(function() { $('#copyBtn .badge').fadeOut(); }, 3000);
    } catch (err) {
        alert('Erreur lors de la copie dans le presse-papier :' + JSON.stringify(err, null, 3));
    }
};

// ===== DOCUMENT READY =====
$(function() {
    // Check if online
    if (window.navigator && !window.navigator.onLine) {
        $('#nav-state-offline').show();
    }
    
    // Initialize with XRPL MainNet
    initializeNetwork('XRPL', 'main');
    
    // Initialize price widget
    PriceWidget.init();

    // Ensure watermark is set correctly on load
    setTimeout(() => {
        setTheme('XRPL', 'main');
    }, 100);
    
    // Network dropdown handlers
    $('#blockchain-select').on('change', function() {
        const networkType = this.value;
        const serverType = $('input[name="network"]:checked').val();
        initializeNetwork(networkType, serverType);
    });
    
    $('input[name="network"]').on('change', function() {
        const serverType = this.value;
        const networkType = $('#blockchain-select').val();
        
        // Update network in existing NETWORK instance
        NETWORK.switchServer(serverType);
        
        // Update theme to reflect network change
        setTheme(networkType, serverType);
        
        // Reset UI state
        $('#addFundsBtn').hide();
        $('#d_nowWhat').hide();
        $('#d_accountValid').css('visibility', 'hidden');
    });
    
    // Currency input handler
    $('#asset_currency').on("input", function() {
        const checkCur = NETWORK.checkCurrency($(this).val());
        if (checkCur.currency) {
            $('.nCurrency').text(checkCur.currency);
        } else {
            $('.nCurrency').text("");
        }
    });
});