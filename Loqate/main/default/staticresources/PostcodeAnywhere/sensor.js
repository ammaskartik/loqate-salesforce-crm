(function (a, c, b, e) {
	a[b] = a[b] || {}; a[b].initial = { accountCode: "", host: "" };
	a[b].on = a[b].on || function () { (a[b].onq = a[b].onq || []).push(arguments) };
	})(window, document, "pca");

//addEventListener polyfill 1.0 / Eirik Backer / MIT Licence
(function (win, doc) {
    if (win.addEventListener) return;		//No need to polyfill

    function docHijack(p) { var old = doc[p]; doc[p] = function (v) { return addListen(old(v)) } }
    function addEvent(on, fn, self) {
        return (self = this).attachEvent('on' + on, function (e) {
            var e = e || win.event;
            e.preventDefault = e.preventDefault || function () { e.returnValue = false }
            e.stopPropagation = e.stopPropagation || function () { e.cancelBubble = true }
            fn.call(self, e);
        });
    }
    function addListen(obj, i) {
        if (i = obj.length) while (i--) obj[i].addEventListener = addEvent;
        else obj.addEventListener = addEvent;
        return obj;
    }

    addListen([doc, win]);
    if ('Element' in win) win.Element.prototype.addEventListener = addEvent;			//IE8
    else {																			//IE < 8
        doc.attachEvent('onreadystatechange', function () { addListen(doc.all) });		//Make sure we also init at domReady
        docHijack('getElementsByTagName');
        docHijack('getElementById');
        docHijack('createElement');
        addListen(doc.all);
    }
})(window, document);

(function () {
    var productList = {

},
        setupMode = false,
        loadedServices = [];
    sendMessage("HB|" + pca.initial.accountCode);
    //#region ready function
    
    var ready = (function () {

        var readyList,
            DOMContentLoaded,
            class2type = {};
        class2type["[object Boolean]"] = "boolean";
        class2type["[object Number]"] = "number";
        class2type["[object String]"] = "string";
        class2type["[object Function]"] = "function";
        class2type["[object Array]"] = "array";
        class2type["[object Date]"] = "date";
        class2type["[object RegExp]"] = "regexp";
        class2type["[object Object]"] = "object";

        var ReadyObj = {
            // Is the DOM ready to be used? Set to true once it occurs.
            isReady: false,
            // A counter to track how many items to wait for before
            // the ready event fires. See #6781
            readyWait: 1,
            // Hold (or release) the ready event
            holdReady: function (hold) {
                if (hold) {
                    ReadyObj.readyWait++;
                } else {
                    ReadyObj.ready(true);
                }
            },
            // Handle when the DOM is ready
            ready: function (wait) {
                // Either a released hold or an DOMready/load event and not yet ready
                if ((wait === true && !--ReadyObj.readyWait) || (wait !== true && !ReadyObj.isReady)) {
                    // Make sure body exists, at least, in case IE gets a little overzealous (ticket #5443).
                    if (!document.body) {
                        return setTimeout(ReadyObj.ready, 1);
                    }

                    // Remember that the DOM is ready
                    ReadyObj.isReady = true;
                    // If a normal DOM Ready event fired, decrement, and wait if need be
                    if (wait !== true && --ReadyObj.readyWait > 0) {
                        return;
                    }
                    // If there are functions bound, to execute
                    readyList.resolveWith(document, [ReadyObj]);

                    // Trigger any bound ready events
                    //if ( ReadyObj.fn.trigger ) {
                    //  ReadyObj( document ).trigger( "ready" ).unbind( "ready" );
                    //}
                }
            },
            bindReady: function () {
                if (readyList) {
                    return;
                }
                readyList = ReadyObj._Deferred();

                // Catch cases where $(document).ready() is called after the
                // browser event has already occurred.
                if (document.readyState === "complete") {
                    // Handle it asynchronously to allow scripts the opportunity to delay ready
                    return setTimeout(ReadyObj.ready, 1);
                }

                // Mozilla, Opera and webkit nightlies currently support this event
                if (document.addEventListener) {
                    // Use the handy event callback
                    document.addEventListener("DOMContentLoaded", DOMContentLoaded, false);
                    // A fallback to window.onload, that will always work
                    window.addEventListener("load", ReadyObj.ready, false);

                    // If IE event model is used
                } else if (document.attachEvent) {
                    // ensure firing before onload,
                    // maybe late but safe also for iframes
                    document.attachEvent("onreadystatechange", DOMContentLoaded);

                    // A fallback to window.onload, that will always work
                    window.attachEvent("onload", ReadyObj.ready);

                    // If IE and not a frame
                    // continually check to see if the document is ready
                    var toplevel = false;

                    try {
                        toplevel = window.frameElement == null;
                    } catch (e) { }

                    if (document.documentElement.doScroll && toplevel) {
                        doScrollCheck();
                    }
                }
            },
            _Deferred: function () {
                var // callbacks list
                    callbacks = [],
                    // stored [ context , args ]
                    fired,
                    // to avoid firing when already doing so
                    firing,
                    // flag to know if the deferred has been cancelled
                    cancelled,
                    // the deferred itself
                    deferred = {

                        // done( f1, f2, ...)
                        done: function () {
                            if (!cancelled) {
                                var args = arguments,
                                    i,
                                    length,
                                    elem,
                                    type,
                                    _fired;
                                if (fired) {
                                    _fired = fired;
                                    fired = 0;
                                }
                                for (i = 0, length = args.length; i < length; i++) {
                                    elem = args[i];
                                    type = ReadyObj.type(elem);
                                    if (type === "array") {
                                        deferred.done.apply(deferred, elem);
                                    } else if (type === "function") {
                                        callbacks.push(elem);
                                    }
                                }
                                if (_fired) {
                                    deferred.resolveWith(_fired[0], _fired[1]);
                                }
                            }
                            return this;
                        },

                        // resolve with given context and args
                        resolveWith: function (context, args) {
                            if (!cancelled && !fired && !firing) {
                                // make sure args are available (#8421)
                                args = args || [];
                                firing = 1;
                                try {
                                    while (callbacks[0]) {
                                        callbacks.shift().apply(context, args);//shifts a callback, and applies it to document
                                    }
                                }
                                finally {
                                    fired = [context, args];
                                    firing = 0;
                                }
                            }
                            return this;
                        },

                        // resolve with this as context and given arguments
                        resolve: function () {
                            deferred.resolveWith(this, arguments);
                            return this;
                        },

                        // Has this deferred been resolved?
                        isResolved: function () {
                            return !!(firing || fired);
                        },

                        // Cancel
                        cancel: function () {
                            cancelled = 1;
                            callbacks = [];
                            return this;
                        }
                    };

                return deferred;
            },
            type: function (obj) {
                return obj == null ?
                    String(obj) :
                    class2type[Object.prototype.toString.call(obj)] || "object";
            }
        }
        // The DOM ready check for Internet Explorer
        function doScrollCheck() {
            if (ReadyObj.isReady) {
                return;
            }

            try {
                // If IE is used, use the trick by Diego Perini
                // http://javascript.nwbox.com/IEContentLoaded/
                document.documentElement.doScroll("left");
            } catch (e) {
                setTimeout(doScrollCheck, 1);
                return;
            }

            // and execute any waiting functions
            ReadyObj.ready();
        }
        // Cleanup functions for the document ready method
        if (document.addEventListener) {
            DOMContentLoaded = function () {
                document.removeEventListener("DOMContentLoaded", DOMContentLoaded, false);
                ReadyObj.ready();
            };

        } else if (document.attachEvent) {
            DOMContentLoaded = function () {
                // Make sure body exists, at least, in case IE gets a little overzealous (ticket #5443).
                if (document.readyState === "complete") {
                    document.detachEvent("onreadystatechange", DOMContentLoaded);
                    ReadyObj.ready();
                }
            };
        }
        function ready(fn) {
            // Attach the listeners
            ReadyObj.bindReady();

            var type = ReadyObj.type(fn);

            // Add the callback
            readyList.done(fn);//readyList is result of _Deferred()
        }
        return ready;
    })();


    //#endregion

    //#region cookies
    pca.cookies = function (name, value, expires) {
        if (typeof value !== "undefined") {
            //set cookie
            if (typeof value == "object")
                value = JSON.stringify(value);
            if (typeof expires == "number") {
                expires = new Date(new Date().getTime() + (expires * 1000 * 60 * 60 * 24));
            }
            var cookString = [
                encodeURIComponent(name), "=", encodeURIComponent(value),
                typeof expires === "undefined" ? "" : "; expires=" + expires.toUTCString(),
                "; path=/;"
            ].join('');
            document.cookie = cookString;


        }


        var cs = document.cookie ? document.cookie.split('; ') : [];
        for (var i = 0; i < cs.length; i++) {
            var c = cs[i];
            var bits = c.split('=');
            if (name === decodeURIComponent(bits[0])) {
                try {
                    return utils.parseJSON(decodeURIComponent(bits[1]));
                } catch (err) {
                    return decodeURIComponent(bits[1]);
                }
            }
        }
        return "";

    };
    //#endregion

    //#region platform methods
    pca.platform = pca.platform || {};
    pca.platform.productList = productList;
    pca.platform.elementExists = elementExists;
    pca.platform.getBindingsForService = function (s) {
        var bindings = [];
        for (var key in productList) {
            if (productList.hasOwnProperty(key)) {
                if (productList[key].hasOwnProperty(s) && productList[key][s].hasOwnProperty("bindings")) {
                    if (CheckRestrictions(productList[key][s].restrictions)) {
                        var sBindings = productList[key][s].bindings;
                        for (var i = 0; i < sBindings.length; i++) {
                            bindings.push(sBindings[i]);
                        }
                    }
                }
            }
        }
        return bindings;
    }
    pca.platform.fire = function (event, args) {
        if (typeof pca.onq !== "undefined") {
            for (var i = 0; i < pca.onq.length; i++) {
                if (pca.onq[i][0] === event) {
                    var cb = pca.onq[i][pca.onq[i].length - 1];
                    if (typeof cb == "function") {
                        cb.apply(null, args);
                    }
                }
            }
        }
    };
    pca.platform.getTypeForServiceName = function(name) {
        switch (name) {
            case "PLATFORM_CAPTUREPLUS":
            case "PLATFORM_CAPTUREPLUS_BETA":
                return "capture+";
            case "PLATFORM_EMAILVALIDATION":
                return "emailvalidation";
            case "PLATFORM_MOBILEVALIDATION":
                return "mobilevalidation";
        }
        return "";
    };
    pca.load = load;
    //#endregion

    ready(function() {
        load();
    });


    function load(selector) {
        selector = selector || null;
        var servicesToLoad = [];
        var serviceVersions = [];
        var keyToLoadWith = "";
        for (var key in productList) {
            if (productList.hasOwnProperty(key)) {
                keyToLoadWith = key;
                if (key === selector || selector == null) {
                    var serviceList = productList[key];
                    for (var service in serviceList) {
                        if (serviceList.hasOwnProperty(service)) {
                            pca.platform.fire("restrictions", [pca.platform.getTypeForServiceName(service), key, serviceList[service]["restrictions"]]);
                            var restrictions = serviceList[service]["restrictions"];
                            var versionNumber = 1.0;
                            if (serviceList[service].hasOwnProperty("version")) {
                                versionNumber = serviceList[service]["version"];
                            }
                            if (CheckRestrictions(restrictions)) {
                                if (servicesToLoad.indexOf(service) === -1) {
                                    servicesToLoad.push(service);
                                    serviceVersions.push(versionNumber);
                                }
                            }
                        }
                    }
                }
            }
        }
        initServices(servicesToLoad, keyToLoadWith, serviceVersions);
    }


    function initServices(services, key, serviceVersions) {
        
        for (var i = 0; i < services.length; i++) {
            var service = services[i].toUpperCase();
            var serviceVersion = serviceVersions[i].toFixed(2);
            if (loadedServices.indexOf(service) === -1) {
                switch (service) {
                    case "PLATFORM_CAPTUREPLUS":
                        loadCSS("//services.postcodeanywhere.co.uk/css/platformcaptureplus-" + serviceVersion + ".min.css?key=" + key);
                        loadJS("//services.postcodeanywhere.co.uk/js/platformcaptureplus-" + serviceVersion + ".js?key=" + key);
                        break;
                    case "PLATFORM_CAPTUREPLUS_BETA":
                        loadCSS("//services.postcodeanywhere.co.uk/css/platformcaptureplus-" + serviceVersion + ".min.css?key=" + key);
                        loadJS("//services.postcodeanywhere.co.uk/js/platformcaptureplus-" + serviceVersion + ".js?key=" + key);
                        break;
                    case "PLATFORM_EMAILVALIDATION":
                        loadCSS("//services.postcodeanywhere.co.uk/css/platformemailvalidation-" + serviceVersion + ".min.css?key=" + key);
                        loadJS("//services.postcodeanywhere.co.uk/js/platformemailvalidation-" + serviceVersion + ".js?key=" + key);
                        break;
                    case "PLATFORM_MOBILEVALIDATION":
                        loadCSS("//services.postcodeanywhere.co.uk/css/platformmobilevalidation-" + serviceVersion + ".min.css?key=" + key);
                        loadJS("//services.postcodeanywhere.co.uk/js/platformmobilevalidation-" + serviceVersion + ".js?key=" + key);
                        break;
                    default:
                }
                loadedServices.push(service);
            } else {
                switch (service) {
                    case "PLATFORM_CAPTUREPLUS":
                    case "PLATFORM_CAPTUREPLUS_BETA":
                        if (pca.capturePlus && pca.capturePlus.load) {
                            pca.capturePlus.load();
                        }
                        break;
                    case "PLATFORM_EMAILVALIDATION":
                        if (pca.emailValidation && pca.emailValidation.load) {
                            pca.emailValidation.load();
                        }
                        break;
                    case "PLATFORM_MOBILEVALIDATION":
                        if (pca.mobileValidation && pca.mobileValidation.load) {
                            pca.mobileValidation.load();
                        }
                        break;
                }
            }
            
        }
       
    }

    //#region Restrictions
    
    function CheckRestrictions(restrictionsList) {
        if (setupMode)
            return true;
        for (var i = 0; i < restrictionsList.length; i++) {
            var restriction = restrictionsList[i];
            switch (restriction.Key) {
                case "inactive":
                    return false;
                case "fieldPresent":
                    if (!elementExists(restriction.Value))
                        return false;
                    break;
                case "urlRegex":
                    if (!(new RegExp(document.location.href).test(restriction.Value)))
                        return false;
                    break;
            }
        }
        return true;
    }

    var fuzzyTags = ["*"];
    function elementExists(reference, base) {
        if (!reference)
            return null;

        if (typeof reference.nodeType == "number") //Is a HTML DOM Node
            return reference;

        if (typeof reference == 'string') {
            base = elementExists(base) || document;

            var byId = base.getElementById ? base.getElementById(reference) : null;
            if (byId) return byId;

            var byName = base.getElementsByName ? base.getElementsByName(reference) : null;
            if (byName.length) return byName[0];
        }

        //try a regex match if allowed
        return function(regex, base) {
            if (typeof regex == 'string') {
                try {
                    regex = new RegExp(regex);
                } catch (e) {
                    return null;
                }
            }

            //make sure its a RegExp
            if (regex && typeof regex == 'object' && regex.constructor == RegExp) {
                base = elementExists(base) || document;

                for (var t = 0; t < fuzzyTags.length; t++) {
                    var elements = base.getElementsByTagName(fuzzyTags[t]);

                    for (var i = 0; i < elements.length; i++) {
                        var elem = elements[i];
                        if (elem.id && regex.test(elem.id))
                            return elem;
                    }
                }
            }

            return null;
        }(reference, base);
    }
    //#endregion
    //#region Generic Loaders
    

    function loadJS(src) {
        var e = document.createElement("script");
        e.async = true;
        e.src = src;
        document.getElementsByTagName("head")[0].appendChild(e);
    };


    function loadCSS(href) {
        var e = document.createElement("link");
        e.rel = "stylesheet";
        e.type = "text/css";
        e.href = href;
        document.getElementsByTagName("head")[0].appendChild(e);
    };

    function receiveMessage(event) {
      
        if (event.origin.substring(event.origin.length - ".pcapredict.com".length, event.origin.length) === ".pcapredict.com" || event.origin.substring(event.origin.length - ".pcapredict.co.uk".length, event.origin.length) === ".pcapredict.co.uk") {
            var msg = JSON.parse(event.data);
            switch(msg.cmd) {
                case "PREPARE":
                    setupMode = true;
                    break;
                case "SETUP":
                    startSetup(msg.key, msg.token, msg.culture, msg.priceLists, msg.latestVersions);
                    break;
                case "ECHO":
                    sendMessage(msg.value);
                    break;
            }
        }
    }

    function sendMessage(msg) {
        if (typeof parent !== "undefined") {
            parent.postMessage(JSON.stringify(msg), "*");
        }
    }

    window.addEventListener("message", receiveMessage, false);
    window.addEventListener("unload", function () {
        sendMessage("navigation");
    });

    function startSetup(key, token, culture, priceLists, latestVersions) {
        //if (loadedServices.indexOf(installing) == -1) {
        //    initServices([installing], key);
        //}
        loadSetup(key, token, culture, priceLists, latestVersions);
    }

    function loadSetup(key, token, culture, priceLists, latestVersions) {


        /*
         * 
         * <link href="//services.postcodeanywhere.co.uk/css/popupsetup-4.30.min.css" rel="stylesheet" />
		<script src="http://services.postcodeanywhere.co.uk/js/platformsetuptoolkit-1.00.js"/>
         * 
         */
        pca.platform.tempCredentials = {
            key: key,
            token: token,
            culture: culture,
            priceLists: priceLists,
            latestVersions: latestVersions
        };
        pca.on("setupReady", function (setup) {
            setup.tempKey = key;
            setup.token = token;
            sendMessage("setupLoaded");
        });
        loadCSS("//services.postcodeanywhere.co.uk/css/platformsetuptoolkit-1.00.min.css");
        loadJS("//services.postcodeanywhere.co.uk/js/platformsetuptoolkit-1.00.js");


        //if (pca.ready) {
        //    switch (installing) {
        //        case "PLATFORM_MOBILEVALIDATION":
        //            loadCSS("//services.postcodeanywhere.co.uk/css/popupsetup-4.20.min.css?key=" + key);
        //            loadJS("//services.postcodeanywhere.co.uk/js/MobileSetup-1.00.js?key=" + key + "&culture=" + culture + "&securetoken=" + token);
        //            break;
        //        case "PLATFORM_EMAILVALIDATION":
        //            loadCSS("//services.postcodeanywhere.co.uk/css/popupsetup-4.20.min.css?key=" + key);
        //            loadJS("//services.postcodeanywhere.co.uk/js/EmailSetup-1.00.js?key=" + key + "&culture=" + culture + "&securetoken=" + token);
        //            break;
        //        default:
        //            loadCSS("//services.postcodeanywhere.co.uk/css/popupsetup-4.20.min.css?key=" + key);
        //            loadJS("//services.postcodeanywhere.co.uk/js/popupsetup-4.10.js?key=" + key + "&culture=" + culture + "&securetoken=" + token);
        //            break;
        //    }
            
        //} else {
        //    setTimeout(function() {
        //        loadSetup(key, token, culture, installing);
        //    }, 100);
        //}
    }
    //#endregion

    pca.message = sendMessage;
})();