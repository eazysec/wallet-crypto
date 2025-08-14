// ===== BLOCKCHAIN NETWORK MANAGEMENT =====
const {xrpl,xrplCodec,StellarSdk} = SecureWalletBundle;

const CLASSES = {
    //------------------------------------- XRPL -------------------------------------------
    "XRPL":class XRPL {
        static serverURL = { "main":"wss://xrplcluster.com", "test":"wss://s.altnet.rippletest.net:51233"};
        static isLibLoaded(){
            return !(typeof xrpl === "undefined");
        }
        static curMaxLen = 6;
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
        #cur40ToCur(text){
            if (text.length < XRPL.curMaxLen){ return text; }
            return text.match(/.{1,2}/g).map(function(v){
                return String.fromCharCode(parseInt(v, 16));
            }).join('').replace(/\0/g, '').toUpperCase();
        }
        decode(trx){
            var rawTrx = xrplCodec.decode(trx.tx_blob);
            switch(rawTrx.TransactionType){
                case "Payment":
                    return {
                        type : "Payment",
                        trx : {
                            from : rawTrx.Account,
                            to : rawTrx.Destination,
                            currency : rawTrx.Amount.currency?this.#cur40ToCur(rawTrx.Amount.currency):this.symbol,
                            amount : rawTrx.Amount.value?rawTrx.Amount.value:xrpl.dropsToXrp(rawTrx.Amount),
                            fee : xrpl.dropsToXrp(rawTrx.Fee),
                            tag : rawTrx.DestinationTag,
                            multisign : rawTrx.SigningPubKey == ""
                        }
                    };
                case "TrustSet":
                    return {
                        type : rawTrx.LimitAmount.value==0?"TrustRev":"TrustSet",
                        trx : {
                            from : rawTrx.Account,
                            issuer : rawTrx.LimitAmount.issuer,
                            currency : this.#cur40ToCur(rawTrx.LimitAmount.currency),
                            max : rawTrx.LimitAmount.value,
                            fee : xrpl.dropsToXrp(rawTrx.Fee),
                            multisign : rawTrx.SigningPubKey == ""
                        }
                    };
                case "AccountDelete":
                    return {
                        type : "AccountDelete",
                        trx : {
                            from : rawTrx.Account,
                            to : rawTrx.Destination,
                            fee : xrpl.dropsToXrp(rawTrx.Fee),
                            tag : rawTrx.DestinationTag,
                            multisign : rawTrx.SigningPubKey == ""
                        }
                    };
                case "SignerListSet":
                    return {
                        type : rawTrx.SignerQuorum==0?"SignerListDel":"SignerListSet",
                        trx : {
                            from : rawTrx.Account,
                            signer : rawTrx.SignerEntries?rawTrx.SignerEntries[0].SignerEntry.Account:false,
                            fee : xrpl.dropsToXrp(rawTrx.Fee),
                            multisign : rawTrx.SigningPubKey == ""
                        }
                    };
                case "AccountSet":
                    var flag = rawTrx.SetFlag || rawTrx.ClearFlag || false;
                    if (flag === false || flag != xrpl.AccountSetAsfFlags.asfDisableMaster){
                        return {
                            type:"unknown",
                            trx : rawTrx,
                            multisign : rawTrx.SigningPubKey == ""
                        };
                    }
                    return {
                        type : rawTrx.SetFlag?"MasterOff":"MasterOn",
                        trx : {
                            from : rawTrx.Account,
                            fee : xrpl.dropsToXrp(rawTrx.Fee),
                            multisign : rawTrx.SigningPubKey == ""
                        }
                    };
                default:
                    return {
                        type:"unknown",
                        trx : rawTrx,
                        multisign : rawTrx.SigningPubKey == ""
                    };
            }
        }
        async send(tx){
            if (!tx.tx_blob) throw "Cette transaction n'est pas une transaction XRPL !";
            this.lastSendSuccess = false;
            this.lastTrxHash = tx.hash;
            var resp = await this.client.submitAndWait(tx.tx_blob);
            this.lastSendSuccess = (resp.result.meta.TransactionResult == "tesSUCCESS") || resp.result.meta.TransactionResult || false;
            return resp;
        }
        getLastSendSuccess(){
            return this.lastSendSuccess;
        }
        buildTrxLink(){
            return (this.main?'https://xrpscan.com/tx/':'https://testnet.xrpl.org/transactions/')+this.lastTrxHash;
        }
        tryReadError(err){
            return err.toString();
        }
        static isSuchTransaction(trx){
            return trx.tx_blob && trx.hash ? true : false;
        }
        static isMain(trx){
            return -1;
        }
    },
    //------------------------------------- XLM -------------------------------------------
    "XLM":class XLM {
        static serverURL = { "main":"https://horizon.stellar.org", "test":"https://horizon-testnet.stellar.org"};
        static isLibLoaded(){
            return !(typeof StellarSdk === "undefined");
        }
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
        decode(trx){
            var rawTrx = StellarSdk.TransactionBuilder.fromXDR(trx.XDR,trx.Network);
            var multiSign = false;
            try {
                const kp = StellarSdk.Keypair.fromPublicKey(rawTrx._source);
                multiSign = !kp.verify(rawTrx.hash(), rawTrx.signatures[0].signature());
            } catch (err) {}
            switch(rawTrx._operations[0].type){
                case "createAccount":
                case "payment":
                    return {
                        type : "Payment",
                        trx : {
                            from : rawTrx._source,
                            to : rawTrx._operations[0].destination,
                            currency : rawTrx._operations[0].type=="createAccount"?this.symbol:rawTrx._operations[0].asset.code,
                            amount : rawTrx._operations[0].type=="createAccount"?rawTrx._operations[0].startingBalance.replace(/\.?0+$/,''):rawTrx._operations[0].amount.replace(/\.?0+$/,''),
                            fee : (rawTrx._fee/Math.pow(10,7)).toFixed(7).replace(/0+$/,''),
                            tag : rawTrx._memo._value?(new TextDecoder().decode(rawTrx._memo._value)):rawTrx._memo._value,
                            multisign : multiSign
                        }
                    }
                case "changeTrust":
                    return {
                        type : rawTrx._operations[0].limit==0?"TrustRev":"TrustSet",
                        trx : {
                            from : rawTrx._source,
                            issuer : rawTrx._operations[0].line.issuer,
                            currency : rawTrx._operations[0].line.code,
                            max : rawTrx._operations[0].limit.replace(/\.?0+$/,''),
                            fee : (rawTrx._fee/Math.pow(10,7)).toFixed(7).replace(/0+$/,''),
                            multisign : multiSign
                        }
                    };
                case "accountMerge":
                    return {
                        type : "AccountDelete",
                        trx : {
                            from : rawTrx._source,
                            to : rawTrx._operations[0].destination,
                            fee : (rawTrx._fee/Math.pow(10,7)).toFixed(7).replace(/0+$/,''),
                            tag : rawTrx._memo._value?(new TextDecoder().decode(rawTrx._memo._value)):rawTrx._memo._value,
                            multisign : multiSign
                        }
                    };
                case "setOptions":
                    if (rawTrx._operations[0].signer || rawTrx._operations[0].masterWeight >= 0){
                        var signer = rawTrx._operations[0].signer;
                        var onMaster = rawTrx._operations[0].masterWeight >= 0;
                        var signSet = onMaster?rawTrx._operations[0].masterWeight>0:signer.weight > 0;
                        return {
                            type : onMaster?(signSet?"MasterOn":"MasterOff"):(signSet?"SignerListSet":"SignerListDel"),
                            trx : {
                                from : rawTrx._source,
                                signer : onMaster?false:signer.ed25519PublicKey,
                                fee : (rawTrx._fee/Math.pow(10,7)).toFixed(7).replace(/0+$/,''),
                                multisign : multiSign
                            }
                        };
                    } else {
                        return {
                            type:"unknown",
                            trx : rawTrx,
                            multisign : multiSign
                        };
                    }
                default:
                    return {
                        type:"unknown",
                        trx : rawTrx,
                        multisign : multiSign
                    };
            }
        }
        async send(tx){
            if (!tx.XDR) throw "Cette transaction n'est pas une transaction XLM !";
            this.lastSendSuccess = false;
            var transaction = StellarSdk.TransactionBuilder.fromXDR(tx.XDR,tx.Network);
            var transactionResult = await this.server.submitTransaction(transaction);
            this.lastTrxHash = transactionResult.id;
            this.lastSendSuccess = true;
            return transactionResult;
        }
        getLastSendSuccess(){
            return this.lastSendSuccess;
        }
        buildTrxLink(){
            return (this.main?'https://lumenscan.io/txns/':'https://testnet.lumenscan.io/txns/')+this.lastTrxHash;
        }
        tryReadError(err){
            if (err.response && err.response.data && err.response.data.extras && err.response.data.extras.result_codes && err.response.data.extras.result_codes){
                return err.toString()+" - Reason : <br/>"+JSON.stringify(err.response.data.extras.result_codes,null, 3);
            } else {
                return err.toString();
            }
        }
        static isSuchTransaction(trx){
            return trx.XDR && trx.Network ? true : false;
        }
        static isMain(trx){
            return (trx.Network && trx.Network.indexOf("Test")>=0)?0:1;
        }
    }
};

// ===== GLOBAL VARIABLES =====
var NETWORK;
const _online_ = {};

// ===== NETWORK AND THEME MANAGEMENT =====
function updateThemes(networkType, serverType) {
    const body = document.body;
    
    // Remove existing theme classes
    body.className = body.className.replace(/\b(xrpl|xlm)-theme\b/g, '');
    body.className = body.className.replace(/\b(mainnet|testnet)-theme\b/g, '');
    
    // Add new theme classes
    body.classList.add(`${networkType.toLowerCase()}-theme`);
    body.classList.add(`${serverType === 'main' ? 'mainnet' : 'testnet'}-theme`);
    
    // Update currency symbol in background
    const currencySymbol = {
        'XRPL': 'XRP',
        'XLM': 'XLM'
    };
    
    $('.cur').text(currencySymbol[networkType]);
    
    // Update tutorial links
    const tutorials = {
        'XRPL': 'https://youtu.be/djt5ZKKJrWI',
        'XLM': 'https://youtu.be/CJpHtLly6n4'
    };
    
    $('#tuto-video').attr('href', tutorials[networkType]);
    
    // Debug - log the theme changes
    console.log('Theme updated:', networkType, serverType, body.className);
}

function highlightAddr(addr){
    return '<b>'+addr.substr(0,4)+'</b><span style="color:#bbb;">'+addr.substr(4,addr.length-8)+'</span><b>'+addr.substr(addr.length - 4)+'</b>';
}

function stringify(jsObj){
    return JSON.stringify(jsObj, null, 3).replace(/\n/g, "<br/>").replace(/   /g, "&nbsp;&nbsp;&nbsp;");
}

// ===== MAIN APPLICATION LOGIC =====
_online_.getTrx = function(signedTrx){
    var textArea = $('#trxSigned');
    textArea.removeClass("is-invalid");
    var tx = textArea.val().trim();
    $('.invalid-feedback',textArea.parent()).hide();
    if (tx.length == 0){
        textArea.addClass("is-invalid");
        $('.invalid-feedback',textArea.parent()).text("Veuillez charger un fichier ou copier une transaction signée d'abord !").show();
        return;
    }
    try {
        tx = JSON.parse(tx);
    } catch (error){
        console.error(error);
        textArea.addClass("is-invalid");
        $('.invalid-feedback',textArea.parent()).html("Ce contenu n'est pas un objet JSON valid : <b>"+error.toString()+"</b>").show();
        return;
    }
    return tx;
}

_online_.check = function(signedTrx){
    var tx = _online_.getTrx();
    var decoded = NETWORK.decode(tx);
    var htmlCheck;
    switch(decoded.type){
        case "Payment" :
            htmlCheck = '<div class="checkAlert alert alert-primary" role="alert">'+
                            '<b><u>💸 Transfert:</u></b><br>'+
                            'De : <span class="badge text-bg-secondary">'+highlightAddr(decoded.trx.from)+'</span><br>'+
                            'Vers : <span class="badge text-bg-primary">'+highlightAddr(decoded.trx.to)+'</span><br>'+
                            'Tag : <span class="badge text-bg-success">'+(decoded.trx.tag?decoded.trx.tag:'Aucun tag')+'</span><br>'+
                            'Montant : <span class="badge text-bg-info">'+decoded.trx.amount+' '+decoded.trx.currency+'</span><br>'+
                            'Frais : <span class="badge text-bg-warning">'+decoded.trx.fee+' '+NETWORK.symbol+'</span>'+
                        '</div>';
            break;
        case "TrustSet" :
        case "TrustRev" :
            htmlCheck = '<div class="checkAlert alert alert-primary" role="alert">'+
                            '<b><u>🔗 '+(decoded.type=="TrustSet"?"Définition":"Révocation")+' d\'une trustline:</u></b><br>'+
                            'Compte : <span class="badge text-bg-secondary">'+highlightAddr(decoded.trx.from)+'</span><br>'+
                            'Issuer : <span class="badge text-bg-primary">'+highlightAddr(decoded.trx.issuer)+'</span><br>'+
                            'Currency : <span class="badge text-bg-success">'+decoded.trx.currency+'</span><br>'+
                            (decoded.trx.max==0?'':'Max : <span class="badge text-bg-info">'+decoded.trx.max+'</span><br>')+
                            'Frais : <span class="badge text-bg-warning">'+decoded.trx.fee+' '+NETWORK.symbol+'</span>'+
                        '</div>';
            break;
        case "AccountDelete" :
            htmlCheck = '<div class="checkAlert alert alert-primary" role="alert">'+
                            '<b><u>🗑️ Suppression de compte:</u></b><br>'+
                            'Compte : <span class="badge text-bg-secondary">'+highlightAddr(decoded.trx.from)+'</span><br>'+
                            'Reliquat vers : <span class="badge text-bg-primary">'+highlightAddr(decoded.trx.to)+'</span><br>'+
                            'Tag : <span class="badge text-bg-success">'+(decoded.trx.tag?decoded.trx.tag:'Aucun tag')+'</span><br>'+
                            'Frais : <span class="badge text-bg-warning">'+decoded.trx.fee+' '+NETWORK.symbol+'</span>'+
                        '</div>';
            break;
        case "SignerListSet" :
            htmlCheck = '<div class="checkAlert alert alert-primary" role="alert">'+
                            '<b><u>👥 Définir signataire:</u></b><br>'+
                            'Compte : <span class="badge text-bg-secondary">'+highlightAddr(decoded.trx.from)+'</span><br>'+
                            'Signataire : <span class="badge text-bg-primary">'+highlightAddr(decoded.trx.signer)+'</span><br>'+
                            'Frais : <span class="badge text-bg-warning">'+decoded.trx.fee+' '+NETWORK.symbol+'</span>'+
                        '</div>';
            break;
        case "SignerListDel" :
            htmlCheck = '<div class="checkAlert alert alert-primary" role="alert">'+
                            '<b><u>👥 Supprimer signataire:</u></b><br>'+
                            'Compte : <span class="badge text-bg-secondary">'+highlightAddr(decoded.trx.from)+'</span><br>'+
                            (decoded.trx.signer?'Signataire : <span class="badge text-bg-primary">'+highlightAddr(decoded.trx.signer)+'</span><br>':'')+
                            'Frais : <span class="badge text-bg-warning">'+decoded.trx.fee+' '+NETWORK.symbol+'</span>'+
                        '</div>';
            break;
        case "MasterOff" :
        case "MasterOn" :
            htmlCheck = '<div class="checkAlert alert alert-primary" role="alert">'+
                            '<b><u>🔐 '+(decoded.type=="MasterOff"?"Désactiver":"(Ré)activer")+' clé de compte maître:</u></b><br>'+
                            'Compte : <span class="badge text-bg-secondary">'+highlightAddr(decoded.trx.from)+'</span><br>'+
                            'Frais : <span class="badge text-bg-warning">'+decoded.trx.fee+' '+NETWORK.symbol+'</span>'+
                        '</div>';
            break;
        default:
            htmlCheck = '<div class="alert alert-warning">'+
                            '<h6 class="alert-heading">⚠️ Transaction non reconnue</h6>'+
                            '<p><strong>Ce type de transaction ne peut être vérifiée ici, mais voici son code pour validation manuelle :</strong></p>'+
                            '<pre class="mt-3"><code>'+stringify(decoded.trx)+'</code></pre>'+
                        '</div>';
    }
    var $htmlCheck = $(htmlCheck);
    if (decoded.trx.multisign){
        $htmlCheck.append($('<div class="mt-2"><em class="text-muted"><small>📝 Note : Cette transaction a été signée par un compte signataire et non par le compte maître.</small></em></div>'));
    }
    $('#d_checkTrx').html($htmlCheck.get(0).outerHTML);
    $('#r_checkTrx').show();
    $('#r_send').show();
};

_online_.send = async function(){
    $('#d_sending').hide();
    $('#trx_OOT').hide();
    var tx = _online_.getTrx();
    var trx_OOT,trx_OOT_OUT;
    try {
        $('#d_sending').show();
        trx_OOT = setTimeout(function(){$('#trx_OOT').show();}, 8000);
        trx_OOT_OUT = setTimeout(function(){
            $('#trxFail').html("<b>Erreur:</b> <i>La clé privée qui signe la transaction n'est probablement pas la bonne.</i>");
            $('#d_trxKO').show();
            $('#sendTrxBtn').removeAttr('disabled');
            $('#d_sending').hide();
        }, 30000);
        var dh = document.body.scrollHeight;
        window.scrollTo(0, dh);
        $('#d_trxOK').hide();
        $('#d_trxKO').hide();
        $('#sendTrxBtn').attr('disabled','true');
        await NETWORK.connect();
        var resp = await NETWORK.send(tx);
        $('#trxResult').html(stringify(resp));
        $('#trxDetailsLink').attr('href',NETWORK.buildTrxLink());
        $('#d_trxOK').show();
        if (NETWORK.getLastSendSuccess() === true) {
            $('#okbut').hide();
            $('#trxResult').removeClass("text-warning").addClass("text-success");
        } else {
            $('#okbut b').text(NETWORK.getLastSendSuccess());
            $('#okbut').show();
            $('#trxResult').removeClass("text-success").addClass("text-warning");
        }
    } catch (error){
        error = NETWORK.tryReadError(error);
        console.error(error);
        $('#trxFail').html(error+"<br/><i>(Voir les logs pour plus de détails)</i>");
        $('#d_trxKO').show();
        $('#sendTrxBtn').removeAttr('disabled');
    } finally {
        $('#d_sending').hide();
        clearTimeout(trx_OOT);
        clearTimeout(trx_OOT_OUT);
        window.scrollTo(0, dh+50);
    }
};

// ===== DOCUMENT READY =====
$(function(){
    // Initialize network change handler
    $(document).on('NETWORK_CHANGED', (e, networkType, serverType) => {
        var _class_ = CLASSES[networkType];
        if (_class_.isLibLoaded()){
            NETWORK = new _class_(serverType);
            $('#libCompromised').hide();
            $('.container').show();
            updateThemes(networkType, serverType);
        } else {
            $('#libCompromised span').text(networkType);
            $('#libCompromised').show();
            $('.container').hide();
        }
    });

    // Network selector change handler
    $('#blockchain-select').on('change', function() {
        var networkType = $(this).val();
        var serverType = $('input[name="network"]:checked').val();
        $(document).trigger('NETWORK_CHANGED', [networkType, serverType]);
    });

    // Server radio button change handler
    $('input[type="radio"][name="network"]').change(function() {
        var networkType = $('#blockchain-select').val();
        var serverType = this.value;
        
        NETWORK.switchServer(serverType);
        updateThemes(networkType, serverType);
    });

    // Initialize with default values
    var initialNetwork = $('#blockchain-select').val();
    var initialServer = $('input[name="network"]:checked').val();
    $(document).trigger('NETWORK_CHANGED', [initialNetwork, initialServer]);

    // File input handler
    $('#trxSignedInputFile').on('change', (event) => {
        var file = event.target.files[0];
        if (file) {
            if (file.type === 'application/json') {
                var reader = new FileReader();
                reader.onload = (e) => {
                    $('#trxSigned').val(e.target.result);
                    $('#sendTrxBtn').removeAttr('disabled');
                    event.target.value = null;
                    
                    // Auto-detect network from filename
                    var matches = file.name.match(/\-[^\.\-]+/g);
                    if (matches.length >= 1) {
                        var networkFromFile = matches[0].replace('-', '').toUpperCase();
                        if (CLASSES[networkFromFile]) {
                            $('#blockchain-select').val(networkFromFile).trigger('change');
                        }
                    }
                    
                    // Auto-detect server (main/test) from filename
                    if (matches.length >= 2) {
                        var serverFromFile = matches[1].replace('-', '').toLowerCase();
                        if (serverFromFile === 'main' || serverFromFile === 'test') {
                            $('input[name="network"][value="' + serverFromFile + '"]').prop('checked', true).trigger('change');
                        }
                    }
                    
                    _online_.check(e.target.result);
                };
                reader.readAsText(file);
            } else {
                alert('Veuillez sélectionner un fichier texte json (.signed.json)');
            }
        }
    });

    // Textarea input handler
    $('#trxSigned').on('input', (event) => {
        var trxSigned = false;
        try {
            trxSigned = JSON.parse($('#trxSigned').val());
        } catch (parsingError){}
        
        if (trxSigned) {
            // Auto-detect blockchain type
            for (var netw of Object.keys(CLASSES)) {
                if (CLASSES[netw].isSuchTransaction(trxSigned)) {
                    $('#blockchain-select').val(netw).trigger('change');
                    
                    // Auto-detect main/test
                    var isMainResult = CLASSES[netw].isMain(trxSigned);
                    if (isMainResult === 1) {
                        $('input[name="network"][value="main"]').prop('checked', true).trigger('change');
                    } else if (isMainResult === 0) {
                        $('input[name="network"][value="test"]').prop('checked', true).trigger('change');
                    }
                    break;
                }
            }
            $('#sendTrxBtn').removeAttr('disabled');
            _online_.check($('#trxSigned').val());
        }
    });

    // Check if offline
    if (window.navigator && !window.navigator.onLine) {
        $('#nav-state-offline').show();
    }

    // Initialize button as disabled
    $('#sendTrxBtn').attr('disabled', 'true');
});