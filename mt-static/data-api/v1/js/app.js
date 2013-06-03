/*
 * Movable Type (r) Open Source (C) 2001-2013 Six Apart, Ltd.
 * This program is distributed under the terms of the
 * GNU General Public License, version 2.
 *
 * Includes jQuery JavaScript Library to serialize a HTMLFormElement
 * http://jquery.com/
 * Copyright 2005, 2013 jQuery Foundation, Inc. and other contributors
 * Released under the MIT license
 * http://jquery.org/license
 *
 * $Id$
 */
;(function(window) {
    
var DataAPI = function(options) {
    this.o = {
        clientId: undefined,
        baseUrl: '',
        cookieDomain: undefined,
        cookiePath: undefined,
        async: true,
        disableFormData: false
    };
    for (k in options) {
        if (k in this.o) {
            if (typeof this.o[k] === 'object' && this.o[k] !== null) {
                for (l in this.o[k]) {
                   this.o[k][l] = options[k][l]; 
                }
            }
            else {
                this.o[k] = options[k];
            }
        }
        else {
            throw 'Unkown option: ' + k;
        }
    }

    if (! this.o.clientId) {
        throw 'The "clientId" is required.';
    }

    this.callbacks = [];
    this.tokenData = null;
    this.iframeId  = 0;
}

DataAPI.accessTokenKey = 'mt_data_api_access_token';
DataAPI.iframePrefix   = 'mt_data_api_iframe_';
DataAPI.prototype      = {
    getAuthorizationUrl: function(redirectUrl) {
        return this.o.baseUrl.replace(/\/*$/, '/') +
            'v' + this.getVersion() +
            '/authorization' +
            '?clientId=' + this.o.clientId +
            '&redirectUrl=' + redirectUrl;
    },

    getCurrentEpoch: function() {
        return Math.round(new Date().getTime() / 1000);
    },

    getNextIframeName: function() {
        return DataAPI.iframePrefix + ++this.iframeId;
    },

    getVersion: function() {
        return 1;
    },
    
    getAppKey: function() {
        return DataAPI.accessTokenKey + '_' + this.o.clientId;
    },
    
    storeToken: function(tokenData) {
        var o = this.o;
        tokenData.start_time = this.getCurrentEpoch();
        Cookie.bake(this.getAppKey(), JSON.stringify(tokenData), o.cookieDomain, o.cookiePath);
        this.tokenData = null;
    },
    
    updateTokenFromDefault: function() {
        var defaultKey    = DataAPI.accessTokenKey,
            defaultCookie = Cookie.fetch(defaultKey);
        if (! defaultCookie) {
            return null;
        }
        
        try {
            var defaultToken = JSON.parse(defaultCookie.value);
        }
        catch (e) {
            return null;
        }
        
        this.storeToken(defaultToken);
        Cookie.bake(defaultKey, '', undefined, '/', new Date(0));
        return defaultToken;
    },
    
    getToken: function() {
        var o = this.o;
        if (! this.tokenData) {
            var token = null;
            
            if (window.location.hash === '#_login') {
                try {
                    token = this.updateTokenFromDefault();
                }
                catch (e) {
                }
            }
            
            if (! token) {
                try {
                    token = JSON.parse(Cookie.fetch(this.getAppKey()).value);
                }
                catch (e) {
                }
            }

            if (token && (token.start_time + token.expires_in < this.getCurrentEpoch())) {
                Cookie.bake(this.getAppKey(), '', o.cookieDomain, o.cookiePath, new Date(0));
                token = null;
            }
            
            this.tokenData = token;
        }
        
        if (! this.tokenData) {
            return null;
        }
        
        return this.tokenData.access_token;
    },
    
    bindEndpointParams: function(endpoint, params) {
        for (k in params) {
            endpoint = endpoint.replace(new RegExp(':' + k), params[k]);
        }
        return endpoint;
    },
    
    _isFileInputElement: function(e) {
        return e instanceof HTMLInputElement && e.type.toLowerCase() === 'file';
    },

    serializeObject: function(v) {
        function f(n) {
            return n < 10 ? '0' + n : n;
        }

        function dateToJSON(v) {
            if (! isFinite(v.valueOf())) {
                return '';
            }

            var off;
            var tz = v.getTimezoneOffset();
            if(tz === 0) {
                off = 'Z';
            }
            else {
                off  = (tz > 0 ? '-': '+');
                tz   = Math.abs(tz);
                off += f(Math.floor(tz / 60)) + ':' + f(tz % 60);
            }

            return v.getFullYear()     + '-' +
                f(v.getMonth() + 1) + '-' +
                f(v.getDate())      + 'T' +
                f(v.getHours())     + ':' +
                f(v.getMinutes())   + ':' +
                f(v.getSeconds())   + off;
        }

        if (v instanceof HTMLFormElement) {
            v = this.serializeFormElement(v);
        }

        var type = typeof v;
        if (type === 'undefined' || v === null || (type === 'number' && ! isFinite(v))) {
            return '';
        }
        else if (v instanceof Date) {
            return dateToJSON(v);
        }
        else if (v instanceof File) {
            return v;
        }
        else if (this._isFileInputElement(v)) {
            return v.files[0];
        }
        else if (type === 'object') {
            return JSON.stringify(v, function(key, value) {
                if (this[key] instanceof Date) {
                    return dateToJSON(this[key]);
                }
                return value;
            });
        }
        else {
            return v;
        }
    },

    serialize: function(params) {
        if (! params) {
            return params;
        }
        if (typeof params === 'string') {
            return params;
        }
        
        var str = '';
        for (k in params) {
            var v = params[k];
            if (str) {
                str += '&';
            }

            str +=
                encodeURIComponent(k) + '=' +
                encodeURIComponent(this.serializeObject(params[k]));
        }
        return str;
    },
    
    _newXMLHttpRequestStandard: function() {
        try {
            return new window.XMLHttpRequest();
        } catch( e ) {}
    },

    _newXMLHttpRequestActiveX: function() {
        try {
            return new window.ActiveXObject("Microsoft.XMLHTTP");
        } catch( e ) {}
    },

    newXMLHttpRequest: function() {
        return this._newXMLHttpRequestStandard()
            || this._newXMLHttpRequestActiveX()
            || false;
    },
    
    _findFileInput: function(params) {
        if (typeof params !== 'object') {
            return null;
        }

        for (k in params) {
            if (this._isFileInputElement(params[k])) {
                return params[k];
            }
        }

        return null;
    },

    sendXMLHttpRequest: function(xhr, method, url, params, defaultParams) {
        if (Object.keys(defaultParams).length) {
            if (! params) {
                params = '';
            }

            for (k in defaultParams) {
                if (window.FormData && params instanceof window.FormData) {
                    params.append(k, defaultParams[k]);
                }
                else {
                    params += ( params === '' ? '' : '&' ) + k + '=' + defaultParams[k];
                }
            }
        }
        
        xhr.open(method, url, this.o.async);
        if (typeof params === 'string') {
            xhr.setRequestHeader(
                'Content-Type', 'application/x-www-form-urlencoded'
            );
        }
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.setRequestHeader(
            'X-MT-Authorization', 'MTAuth access_token=' + this.getToken()
        );
        
        xhr.send(params);
        
        return xhr;
    },

    serializeFormElement: function(form) {
        var submitterTypes = /^(?:submit|button|image|reset)$/i,
            submittable    = /^(?:input|select|textarea|keygen)/i,
            checkableTypes = /^(?:checkbox|radio)$/i;

        var data = {};
        for (var i = 0; i < form.elements.length; i++) {
            var e    = form.elements[i],
                type = e.type;

            if (
                    ! e.name ||
                    e.disabled ||
                    ! submittable.test(e.nodeName) ||
                    submitterTypes.test(type) ||
                    (checkableTypes.test(type) && ! e.checked)
            ) {
                continue;
            }

            if (this._isFileInputElement(e)) {
                data[e.name] = e;
            }
            else {
                data[e.name] = this._elementValue(e);
            }
        }

        return data;
    },

    _elementValue: function(e) {
        if (e.nodeName.toLowerCase() === 'select') {
            var value, option,
                options = e.options,
                index = e.selectedIndex,
                one = e.type === "select-one" || index < 0,
                values = one ? null : [],
                max = one ? index + 1 : options.length,
                i = index < 0 ?
                    max :
                    one ? index : 0;

            // Loop through all the selected options
            for ( ; i < max; i++ ) {
                option = options[ i ];

                // oldIE doesn't update selected after form reset (#2551)
                if ( ( option.selected || i === index ) &&
                        // Don't return options that are disabled or in a disabled optgroup
                        ( !option.parentNode.disabled || option.parentNode.nodeName.toLowerCase() !== "optgroup" ) ) {

                    // Get the specific value for the option
                    value = option.attributes.value;
                    if (!value || value.specified) {
                        value = option.value;
                    }
                    else {
                        value = elem.text;
                    }

                    // We don't need an array for one selects
                    if ( one ) {
                        return value;
                    }

                    // Multi-Selects return an array
                    values.push( value );
                }
            }

            return values;
        }
        else {
            return e.value;
        }
    },
    
    request: function(method, endpoint) {
        var api        = this,
            paramsList = [],
            params     = null,
            callback   = function(){},
            xhr        = null,
            viaXhr     = true,
            originalArguments = Array.prototype.slice.call(arguments);
            defaultParams     = {};

        function serializeParams(params) {
            if (! api.o.disableFormData && window.FormData) {
                if (params instanceof window.FormData) {
                    return params;
                }
                else if (params instanceof HTMLFormElement ) {
                    return new FormData(params);
                }
                else if (window.FormData && typeof params === 'object') {
                    var data = new FormData();
                    for (k in params) {
                        data.append(k, api.serializeObject(params[k]));
                    }
                    return data;
                }
            }


            if (params instanceof HTMLFormElement) {
                params = api.serializeFormElement(params);
                for (k in params) {
                    if (params[k] instanceof Array) {
                        params[k] = params[k].join(',');
                    }
                }
            }

            if (api._findFileInput(params)) {
                viaXhr = false;

                var data = {};
                for (k in params) {
                    if (api._isFileInputElement(params[k])) {
                        data[k] = params[k];
                    }
                    else {
                        data[k] = api.serializeObject(params[k]);
                    }
                }
                params = data;
            }
            else if (typeof params !== 'string') {
                params = api.serialize(params);
            }

            return params;
        }

        function runCallback(response) {
            var status = callback(response);
            if (status !== false) {
                if (response.error) {
                    api.trigger('error', response);
                }
            }
        }

        function needToRetry(response) {
            return response.error &&
                response.error.code === 401 &&
                endpoint !== '/token';
        }

        function retry() {
            api.request('POST', '/token', function(response) {
                if (response.error && response.error.code === 401) {
                    api.trigger('authorizationRequired', response);
                    runCallback(response);
                }
                else {
                    api.storeToken(response);
                    api.request.apply(api, originalArguments);
                }
                return false;
            });
        }


        if (endpoint === '/token' || endpoint === '/authentication') {
            defaultParams['clientId'] = this.o.clientId;
        }
        
        for (var i = 2; i < arguments.length; i++) {
            var v = arguments[i];
            switch (typeof v) {
            case 'function':
                callback = v;
                break;
            case 'object':
                if (
                    (window.ActiveXObject && v instanceof window.ActiveXObject)
                    || (window.XMLHttpRequest && v instanceof window.XMLHttpRequest)
                ) {
                    xhr = v;
                }
                else {
                    paramsList.push(v);
                }
                break;
            case 'string':
                paramsList.push(v);
                break;
            }
        }
        
        if (paramsList.length && (method.toLowerCase() === 'get' || paramsList.length >= 2)) {
            if (endpoint.indexOf('?') === -1) {
                endpoint += '?';
            }
            else {
                endpoint += '&';
            }
            endpoint += this.serialize(paramsList.shift());
        }

        if (paramsList.length) {
            params = serializeParams(paramsList.shift());
        }
        

        if (method.match(/^(put|delete)$/i)) {
            defaultParams['__method'] = method;
            method = 'POST';
        }

        
        var base = this.o.baseUrl.replace(/\/*$/, '/') + 'v' + this.getVersion();
        endpoint = endpoint.replace(/^\/*/, '/');

        if (viaXhr) {
            var xhr = xhr || this.newXMLHttpRequest();
            xhr.onreadystatechange = function() {
                if (xhr.readyState !== 4) {
                    return;
                }

                var response;
                try {
                    response = JSON.parse(xhr.responseText);
                }
                catch (e) {
                    response = {
                        error: {
                            code:    parseInt(xhr.status, 10),
                            message: xhr.statusText
                        }
                    };
                }

                function cleanup() {
                    xhr.onreadystatechange = new Function;
                }

                if (needToRetry(response)) {
                    retry();
                    cleanup();
                    return;
                }

                runCallback(response);

                var url = xhr.getResponseHeader('X-MT-Next-Phase-URL');
                if (url) {
                    xhr.abort();
                    api.sendXMLHttpRequest(xhr, method, base + url, params, defaultParams);
                }
                else {
                    cleanup();
                }
            };
            return this.sendXMLHttpRequest(xhr, method, base + endpoint, params, defaultParams);
        }
        else {
            (function() {
                var target = api.getNextIframeName();
                var form   = document.createElement('form');
                var iframe = document.createElement('iframe');
                var file   = null;

                // Set up a form element
                form.action   = base + endpoint;
                form.target   = target;
                form.method   = method;
                form.encoding = 'multipart/form-data';
                form.enctype  = 'multipart/form-data';

                // Set up a iframe element
                iframe.name           = target;
                iframe.style.position = 'absolute';
                iframe.style.top      = '-9999px';
                document.body.appendChild(iframe);


                if (Object.keys(defaultParams).length) {
                    if (! params) {
                        params = {};
                    }
                    for (k in defaultParams) {
                        params[k] = defaultParams[k];
                    }
                }
                params['X-MT-Authorization'] = 'MTAuth access_token=' + api.getToken();

                for (k in params) {
                    if (api._isFileInputElement(params[k])) {
                        file = params[k];
                        file.parentNode.insertBefore(form, file);
                        form.appendChild(file);
                        continue;
                    }

                    var input   = document.createElement('input');
                    input.type  = 'hidden';
                    input.name  = k;
                    input.value = params[k];
                    form.appendChild(input);
                }

                form.submit();


                function handler(e) {
                    var body     = iframe.contentWindow.document.body,
                        contents = body.textContent || body.innerText,
                        response;

                    function cleanup() {
                        setTimeout(function() {
                            form.parentNode.insertBefore(file, form);
                            form.parentNode.removeChild(form);
                            iframe.parentNode.removeChild(iframe);
                        });
                    }

                    try {
                        response = JSON.parse(contents);
                    }
                    catch (e) {
                        response = {
                            error: {
                                code:    500,
                                message: 'Internal Server Error'
                            }
                        };
                    }

                    if (needToRetry(response)) {
                        retry();
                        cleanup();
                        return;
                    }

                    cleanup();
                    runCallback(response);
                }
                if ( iframe.addEventListener ) {
                    iframe.addEventListener('load', handler, false);
                } else if ( iframe.attachEvent ) {
                    iframe.attachEvent('onload', handler);
                }
            })();

            return;
        }
    },

    on: function(key, callback) {
        if (! this.callbacks[key]) {
            this.callbacks[key] = [];
        }

        this.callbacks[key].push(callback);
    },

    off: function(key, callback) {
        if (callback) {
            var callbacks = this.callbacks[key] || [];

            for (var i = 0; i < callbacks.length; i++) {
                if (callbacks[i] === callback) {
                    callbacks.splice(i, 1);
                    break;
                }
            }
        }
        else {
            delete this.callbacks[key];
        }
    },

    trigger: function(key) {
        var callbacks = this.callbacks[key] || [],
            args      = Array.prototype.slice.call(arguments, 1);

        for (var i = 0; i < callbacks.length; i++) {
            callbacks[i].apply(this, args);
        }
    }
};

window.MT         = window.MT || {};
window.MT.DataAPI = DataAPI;



function exists(x) {
    return (x === undefined || x === null) ? false : true;
};

var Cookie = function( name, value, domain, path, expires, secure ) {
    this.name = name;
    this.value = value;
    this.domain = domain;
    this.path = path;
    this.expires = expires;
    this.secure = secure;
};

Cookie.prototype = {
    /**
     * Get this cookie from the web browser's store of cookies.  Note that if the <code>document.cookie</code>
     * property has been written to repeatedly by the same client code in excess of 4K (regardless of the size
     * of the actual cookies), IE 6 will report an empty <code>document.cookie</code> collection of cookies.
     * @return <code>Cookie</code> The fetched cookie.
     */
    fetch: function() {
        var prefix = escape( this.name ) + "=";
        var cookies = ("" + document.cookie).split( /;\s*/ );
        
        for( var i = 0; i < cookies.length; i++ ) {
            if( cookies[ i ].indexOf( prefix ) == 0 ) {
                this.value = unescape( cookies[ i ].substring( prefix.length ) );
                return this;
            }
        }
                                 
        return undefined;
    },

    
    /**
     * Set and store a cookie in the the web browser's native collection of cookies.
     * @return <code>Cookie</code> The set and stored ("baked") cookie.
     */
    bake: function( value ) {
        if( !exists( this.name ) )
        	return undefined;
		
        if( exists( value ) )
            this.value = value;
        else 
            value = this.value;
		
        var name = escape( this.name );
        value = escape( value );
        
        // log( "Saving value: " + value );
        var attributes = ( this.domain ? "; domain=" + escape( this.domain ) : "") +
            (this.path ? "; path=" + escape( this.path ) : "") +
            (this.expires ? "; expires=" + this.expires.toGMTString() : "") +
            (this.secure ? "; secure=1"  : "");       

        
        var batter = name + "=" + value + attributes;                   
        document.cookie = batter;

        return this;
    },


    remove: function() {
        this.expires = new Date( 0 ); // "Thu, 01 Jan 1970 00:00:00 GMT"
        this.value = "";
        this.bake();     
    }
};

Cookie.fetch = function( name ) {
    var cookie = new this( name );
    return cookie.fetch();        
}

    
Cookie.bake = function( name, value, domain, path, expires, secure ) {
    var cookie = new this( name, value, domain, path, expires, secure );
    return cookie.bake();
};

Cookie.remove = function( name ) {
    var cookie = this.fetch( name );
    if( cookie )
        return cookie.remove();
};


var JSON = window.JSON;
/*
    json2.js
    2012-10-08

    Public Domain.

    NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.

    See http://www.JSON.org/js.html


    This code should be minified before deployment.
    See http://javascript.crockford.com/jsmin.html

    USE YOUR OWN COPY. IT IS EXTREMELY UNWISE TO LOAD CODE FROM SERVERS YOU DO
    NOT CONTROL.


    This file creates a global JSON object containing two methods: stringify
    and parse.

        JSON.stringify(value, replacer, space)
            value       any JavaScript value, usually an object or array.

            replacer    an optional parameter that determines how object
                        values are stringified for objects. It can be a
                        function or an array of strings.

            space       an optional parameter that specifies the indentation
                        of nested structures. If it is omitted, the text will
                        be packed without extra whitespace. If it is a number,
                        it will specify the number of spaces to indent at each
                        level. If it is a string (such as '\t' or '&nbsp;'),
                        it contains the characters used to indent at each level.

            This method produces a JSON text from a JavaScript value.

            When an object value is found, if the object contains a toJSON
            method, its toJSON method will be called and the result will be
            stringified. A toJSON method does not serialize: it returns the
            value represented by the name/value pair that should be serialized,
            or undefined if nothing should be serialized. The toJSON method
            will be passed the key associated with the value, and this will be
            bound to the value

            For example, this would serialize Dates as ISO strings.

                Date.prototype.toJSON = function (key) {
                    function f(n) {
                        // Format integers to have at least two digits.
                        return n < 10 ? '0' + n : n;
                    }

                    return this.getUTCFullYear()   + '-' +
                         f(this.getUTCMonth() + 1) + '-' +
                         f(this.getUTCDate())      + 'T' +
                         f(this.getUTCHours())     + ':' +
                         f(this.getUTCMinutes())   + ':' +
                         f(this.getUTCSeconds())   + 'Z';
                };

            You can provide an optional replacer method. It will be passed the
            key and value of each member, with this bound to the containing
            object. The value that is returned from your method will be
            serialized. If your method returns undefined, then the member will
            be excluded from the serialization.

            If the replacer parameter is an array of strings, then it will be
            used to select the members to be serialized. It filters the results
            such that only members with keys listed in the replacer array are
            stringified.

            Values that do not have JSON representations, such as undefined or
            functions, will not be serialized. Such values in objects will be
            dropped; in arrays they will be replaced with null. You can use
            a replacer function to replace those with JSON values.
            JSON.stringify(undefined) returns undefined.

            The optional space parameter produces a stringification of the
            value that is filled with line breaks and indentation to make it
            easier to read.

            If the space parameter is a non-empty string, then that string will
            be used for indentation. If the space parameter is a number, then
            the indentation will be that many spaces.

            Example:

            text = JSON.stringify(['e', {pluribus: 'unum'}]);
            // text is '["e",{"pluribus":"unum"}]'


            text = JSON.stringify(['e', {pluribus: 'unum'}], null, '\t');
            // text is '[\n\t"e",\n\t{\n\t\t"pluribus": "unum"\n\t}\n]'

            text = JSON.stringify([new Date()], function (key, value) {
                return this[key] instanceof Date ?
                    'Date(' + this[key] + ')' : value;
            });
            // text is '["Date(---current time---)"]'


        JSON.parse(text, reviver)
            This method parses a JSON text to produce an object or array.
            It can throw a SyntaxError exception.

            The optional reviver parameter is a function that can filter and
            transform the results. It receives each of the keys and values,
            and its return value is used instead of the original value.
            If it returns what it received, then the structure is not modified.
            If it returns undefined then the member is deleted.

            Example:

            // Parse the text. Values that look like ISO date strings will
            // be converted to Date objects.

            myData = JSON.parse(text, function (key, value) {
                var a;
                if (typeof value === 'string') {
                    a =
/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
                    if (a) {
                        return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4],
                            +a[5], +a[6]));
                    }
                }
                return value;
            });

            myData = JSON.parse('["Date(09/09/2001)"]', function (key, value) {
                var d;
                if (typeof value === 'string' &&
                        value.slice(0, 5) === 'Date(' &&
                        value.slice(-1) === ')') {
                    d = new Date(value.slice(5, -1));
                    if (d) {
                        return d;
                    }
                }
                return value;
            });


    This is a reference implementation. You are free to copy, modify, or
    redistribute.
*/

/*jslint evil: true, regexp: true */

/*members "", "\b", "\t", "\n", "\f", "\r", "\"", JSON, "\\", apply,
    call, charCodeAt, getUTCDate, getUTCFullYear, getUTCHours,
    getUTCMinutes, getUTCMonth, getUTCSeconds, hasOwnProperty, join,
    lastIndex, length, parse, prototype, push, replace, slice, stringify,
    test, toJSON, toString, valueOf
*/


// Create a JSON object only if one does not already exist. We create the
// methods in a closure to avoid creating global variables.

if (typeof JSON !== 'object') {
    JSON = {};
}

(function () {
    'use strict';

    function f(n) {
        // Format integers to have at least two digits.
        return n < 10 ? '0' + n : n;
    }

    var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        gap,
        indent,
        meta = {    // table of character substitutions
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'
        },
        rep;


    function quote(string) {

// If the string contains no control characters, no quote characters, and no
// backslash characters, then we can safely slap some quotes around it.
// Otherwise we must also replace the offending characters with safe escape
// sequences.

        escapable.lastIndex = 0;
        return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
            var c = meta[a];
            return typeof c === 'string'
                ? c
                : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        }) + '"' : '"' + string + '"';
    }


    function str(key, holder) {

// Produce a string from holder[key].

        var i,          // The loop counter.
            k,          // The member key.
            v,          // The member value.
            length,
            mind = gap,
            partial,
            value = holder[key];

// If the value has a toJSON method, call it to obtain a replacement value.

        if (value && typeof value === 'object' &&
                typeof value.toJSON === 'function') {
            value = value.toJSON(key);
        }

// If we were called with a replacer function, then call the replacer to
// obtain a replacement value.

        if (typeof rep === 'function') {
            value = rep.call(holder, key, value);
        }

// What happens next depends on the value's type.

        switch (typeof value) {
        case 'string':
            return quote(value);

        case 'number':

// JSON numbers must be finite. Encode non-finite numbers as null.

            return isFinite(value) ? String(value) : 'null';

        case 'boolean':
        case 'null':

// If the value is a boolean or null, convert it to a string. Note:
// typeof null does not produce 'null'. The case is included here in
// the remote chance that this gets fixed someday.

            return String(value);

// If the type is 'object', we might be dealing with an object or an array or
// null.

        case 'object':

// Due to a specification blunder in ECMAScript, typeof null is 'object',
// so watch out for that case.

            if (!value) {
                return 'null';
            }

// Make an array to hold the partial results of stringifying this object value.

            gap += indent;
            partial = [];

// Is the value an array?

            if (Object.prototype.toString.apply(value) === '[object Array]') {

// The value is an array. Stringify every element. Use null as a placeholder
// for non-JSON values.

                length = value.length;
                for (i = 0; i < length; i += 1) {
                    partial[i] = str(i, value) || 'null';
                }

// Join all of the elements together, separated with commas, and wrap them in
// brackets.

                v = partial.length === 0
                    ? '[]'
                    : gap
                    ? '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']'
                    : '[' + partial.join(',') + ']';
                gap = mind;
                return v;
            }

// If the replacer is an array, use it to select the members to be stringified.

            if (rep && typeof rep === 'object') {
                length = rep.length;
                for (i = 0; i < length; i += 1) {
                    if (typeof rep[i] === 'string') {
                        k = rep[i];
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            } else {

// Otherwise, iterate through all of the keys in the object.

                for (k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }

// Join all of the member texts together, separated with commas,
// and wrap them in braces.

            v = partial.length === 0
                ? '{}'
                : gap
                ? '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}'
                : '{' + partial.join(',') + '}';
            gap = mind;
            return v;
        }
    }

// If the JSON object does not yet have a stringify method, give it one.

    if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function (value, replacer, space) {

// The stringify method takes a value and an optional replacer, and an optional
// space parameter, and returns a JSON text. The replacer can be a function
// that can replace values, or an array of strings that will select the keys.
// A default replacer method can be provided. Use of the space parameter can
// produce text that is more easily readable.

            var i;
            gap = '';
            indent = '';

// If the space parameter is a number, make an indent string containing that
// many spaces.

            if (typeof space === 'number') {
                for (i = 0; i < space; i += 1) {
                    indent += ' ';
                }

// If the space parameter is a string, it will be used as the indent string.

            } else if (typeof space === 'string') {
                indent = space;
            }

// If there is a replacer, it must be a function or an array.
// Otherwise, throw an error.

            rep = replacer;
            if (replacer && typeof replacer !== 'function' &&
                    (typeof replacer !== 'object' ||
                    typeof replacer.length !== 'number')) {
                throw new Error('JSON.stringify');
            }

// Make a fake root object containing our value under the key of ''.
// Return the result of stringifying the value.

            return str('', {'': value});
        };
    }


// If the JSON object does not yet have a parse method, give it one.

    if (typeof JSON.parse !== 'function') {
        JSON.parse = function (text, reviver) {

// The parse method takes a text and an optional reviver function, and returns
// a JavaScript value if the text is a valid JSON text.

            var j;

            function walk(holder, key) {

// The walk method is used to recursively walk the resulting structure so
// that modifications can be made.

                var k, v, value = holder[key];
                if (value && typeof value === 'object') {
                    for (k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            v = walk(value, k);
                            if (v !== undefined) {
                                value[k] = v;
                            } else {
                                delete value[k];
                            }
                        }
                    }
                }
                return reviver.call(holder, key, value);
            }


// Parsing happens in four stages. In the first stage, we replace certain
// Unicode characters with escape sequences. JavaScript handles many characters
// incorrectly, either silently deleting them, or treating them as line endings.

            text = String(text);
            cx.lastIndex = 0;
            if (cx.test(text)) {
                text = text.replace(cx, function (a) {
                    return '\\u' +
                        ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                });
            }

// In the second stage, we run the text against regular expressions that look
// for non-JSON patterns. We are especially concerned with '()' and 'new'
// because they can cause invocation, and '=' because it can cause mutation.
// But just to be safe, we want to reject all unexpected forms.

// We split the second stage into 4 regexp operations in order to work around
// crippling inefficiencies in IE's and Safari's regexp engines. First we
// replace the JSON backslash pairs with '@' (a non-JSON character). Second, we
// replace all simple value tokens with ']' characters. Third, we delete all
// open brackets that follow a colon or comma or that begin the text. Finally,
// we look to see that the remaining characters are only whitespace or ']' or
// ',' or ':' or '{' or '}'. If that is so, then the text is safe for eval.

            if (/^[\],:{}\s]*$/
                    .test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
                        .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
                        .replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

// In the third stage we use the eval function to compile the text into a
// JavaScript structure. The '{' operator is subject to a syntactic ambiguity
// in JavaScript: it can begin a block or an object literal. We wrap the text
// in parens to eliminate the ambiguity.

                j = eval('(' + text + ')');

// In the optional fourth stage, we recursively walk the new structure, passing
// each name/value pair to a reviver function for possible transformation.

                return typeof reviver === 'function'
                    ? walk({'': j}, '')
                    : j;
            }

// If the text is not JSON parseable, then a SyntaxError is thrown.

            throw new SyntaxError('JSON.parse');
        };
    }
}());


})(window);
