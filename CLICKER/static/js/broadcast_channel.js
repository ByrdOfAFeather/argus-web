!function i(s,a,u){function c(t,e){if(!a[t]){if(!s[t]){var n="function"==typeof require&&require;if(!e&&n)return n(t,!0);if(l)return l(t,!0);var r=new Error("Cannot find module '"+t+"'");throw r.code="MODULE_NOT_FOUND",r}var o=a[t]={exports:{}};s[t][0].call(o.exports,function(e){return c(s[t][1][e]||e)},o,o.exports,i,s,a,u)}return a[t].exports}for(var l="function"==typeof require&&require,e=0;e<u.length;e++)c(u[e]);return c}({1:[function(e,t,n){"use strict";var r=e("./index.es5.js"),o=e("./leader-election/index.es5.js");window.BroadcastChannel2=r,window.LeaderElection=o},{"./index.es5.js":2,"./leader-election/index.es5.js":4}],2:[function(e,t,n){"use strict";var r=e("@babel/runtime/helpers/interopRequireDefault")(e("./index.js"));t.exports=r.default},{"./index.js":3,"@babel/runtime/helpers/interopRequireDefault":14}],3:[function(e,t,n){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n.default=void 0;function r(e,t){this.name=e,o&&(t=o),this.options=(0,a.fillOptionsWithDefaults)(t),this.method=(0,s.chooseMethod)(this.options),this._iL=!1,this._onML=null,this._addEL={message:[],internal:[]},this._befC=[],this._prepP=null,function(t){var e=t.method.create(t.name,t.options);(0,i.isPromise)(e)?(t._prepP=e).then(function(e){t._state=e}):t._state=e}(this)}var o,i=e("./util.js"),s=e("./method-chooser.js"),a=e("./options.js");function u(e,t,n){var r={time:e.method.microSeconds(),type:t,data:n};return(e._prepP?e._prepP:Promise.resolve()).then(function(){return e.method.postMessage(e._state,r)})}function c(e){return 0<e._addEL.message.length||0<e._addEL.internal.length}function l(e,t,n){e._addEL[t].push(n),function(e){if(!e._iL&&c(e)){var t=function(t){e._addEL[t.type].forEach(function(e){t.time>=e.time&&e.fn(t.data)})},n=e.method.microSeconds();e._prepP?e._prepP.then(function(){e._iL=!0,e.method.onMessage(e._state,t,n)}):(e._iL=!0,e.method.onMessage(e._state,t,n))}}(e)}function d(e,t,n){e._addEL[t]=e._addEL[t].filter(function(e){return e!==n}),function(e){if(e._iL&&!c(e)){e._iL=!1;var t=e.method.microSeconds();e.method.onMessage(e._state,null,t)}}(e)}r._pubkey=!0,r.clearNodeFolder=function(e){e=(0,a.fillOptionsWithDefaults)(e);var t=(0,s.chooseMethod)(e);return"node"===t.type?t.clearNodeFolder().then(function(){return!0}):Promise.resolve(!1)},r.enforceOptions=function(e){o=e},r.prototype={postMessage:function(e){if(this.closed)throw new Error("BroadcastChannel.postMessage(): Cannot post message after channel has closed");return u(this,"message",e)},postInternal:function(e){return u(this,"internal",e)},set onmessage(e){var t={time:this.method.microSeconds(),fn:e};d(this,"message",this._onML),e&&"function"==typeof e?(this._onML=t,l(this,"message",t)):this._onML=null},addEventListener:function(e,t){var n=this.method.microSeconds();l(this,e,{time:n,fn:t})},removeEventListener:function(e,t){var n=this._addEL[e].find(function(e){return e.fn===t});d(this,e,n)},close:function(){var e=this;if(!this.closed){this.closed=!0;var t=this._prepP?this._prepP:Promise.resolve();return this._onML=null,this._addEL.message=[],t.then(function(){return Promise.all(e._befC.map(function(e){return e()}))}).then(function(){return e.method.close(e._state)})}},get type(){return this.method.type}};var f=r;n.default=f},{"./method-chooser.js":6,"./options.js":12,"./util.js":13}],4:[function(e,t,n){"use strict";var r=e("@babel/runtime/helpers/interopRequireDefault")(e("./index.js"));t.exports=r.default},{"./index.js":5,"@babel/runtime/helpers/interopRequireDefault":14}],5:[function(e,t,n){"use strict";var r=e("@babel/runtime/helpers/interopRequireDefault");Object.defineProperty(n,"__esModule",{value:!0}),n.create=u,n.default=void 0;var i=e("../util.js"),s=r(e("unload")),o=function(e,t){this._channel=e,this._options=t,this.isLeader=!1,this.isDead=!1,this.token=(0,i.randomToken)(10),this._isApl=!1,this._reApply=!1,this._unl=[],this._lstns=[],this._invs=[]};function a(e,t){var n={context:"leader",action:t,token:e.token};return e._channel.postInternal(n)}function u(e,t){if(e._leaderElector)throw new Error("BroadcastChannel already has a leader-elector");t=function(e,t){return e=e||{},(e=JSON.parse(JSON.stringify(e))).fallbackInterval||(e.fallbackInterval=3e3),e.responseTime||(e.responseTime=t.method.averageResponseTime(t.options)),e}(t,e);var n=new o(e,t);return e._befC.push(function(){return n.die()}),e._leaderElector=n}o.prototype={applyOnce:function(){var t=this;if(this.isLeader)return Promise.resolve(!1);if(this.isDead)return Promise.resolve(!1);if(this._isApl)return this._reApply=!0,Promise.resolve(!1);function n(e){"leader"===e.context&&e.token!=t.token&&(o.push(e),"apply"===e.action&&e.token>t.token&&(r=!0),"tell"===e.action&&(r=!0))}var r=!(this._isApl=!0),o=[];return this._channel.addEventListener("internal",n),a(this,"apply").then(function(){return(0,i.sleep)(t._options.responseTime)}).then(function(){return r?Promise.reject(new Error):a(t,"apply")}).then(function(){return(0,i.sleep)(t._options.responseTime)}).then(function(){return r?Promise.reject(new Error):a(t)}).then(function(){return function(t){t.isLeader=!0;var e=s.default.add(function(){return t.die()});t._unl.push(e);function n(e){"leader"===e.context&&"apply"===e.action&&a(t,"tell")}return t._channel.addEventListener("internal",n),t._lstns.push(n),a(t,"tell")}(t)}).then(function(){return!0}).catch(function(){return!1}).then(function(e){return t._channel.removeEventListener("internal",n),t._isApl=!1,!e&&t._reApply?(t._reApply=!1,t.applyOnce()):e})},awaitLeadership:function(){return this._aLP||(this._aLP=function(i){return i.isLeader?Promise.resolve():new Promise(function(e){function t(){n||(n=!0,clearInterval(r),i._channel.removeEventListener("internal",o),e(!0))}var n=!1;i.applyOnce().then(function(){i.isLeader&&t()});var r=setInterval(function(){i.applyOnce().then(function(){i.isLeader&&t()})},i._options.fallbackInterval);i._invs.push(r);var o=function(e){"leader"===e.context&&"death"===e.action&&i.applyOnce().then(function(){i.isLeader&&t()})};i._channel.addEventListener("internal",o),i._lstns.push(o)})}(this)),this._aLP},die:function(){var t=this;if(!this.isDead)return this.isDead=!0,this._lstns.forEach(function(e){return t._channel.removeEventListener("internal",e)}),this._invs.forEach(function(e){return clearInterval(e)}),this._unl.forEach(function(e){e.remove()}),a(this,"death")}};var c={create:u};n.default=c},{"../util.js":13,"@babel/runtime/helpers/interopRequireDefault":14,unload:19}],6:[function(e,t,n){"use strict";var r=e("@babel/runtime/helpers/interopRequireDefault");Object.defineProperty(n,"__esModule",{value:!0}),n.chooseMethod=function(t){if(t.type){if("simulate"===t.type)return a.default;var e=c.find(function(e){return e.type===t.type});if(e)return e;throw new Error("method-type "+t.type+" not found")}var n=c;t.webWorkerSupport||u.isNode||(n=c.filter(function(e){return"idb"!==e.type}));var r=n.find(function(e){return e.canBeUsed()});{if(r)return r;throw new Error("No useable methode found:"+JSON.stringify(c.map(function(e){return e.type})))}};var o=r(e("./methods/native.js")),i=r(e("./methods/indexed-db.js")),s=r(e("./methods/localstorage.js")),a=r(e("./methods/simulate.js")),u=e("./util"),c=[o.default,i.default,s.default];if(u.isNode){var l=e("../../src/methods/node.js");"function"==typeof l.canBeUsed&&c.push(l)}},{"./methods/indexed-db.js":7,"./methods/localstorage.js":8,"./methods/native.js":9,"./methods/simulate.js":10,"./util":13,"@babel/runtime/helpers/interopRequireDefault":14}],7:[function(e,t,n){"use strict";var r=e("@babel/runtime/helpers/interopRequireDefault");Object.defineProperty(n,"__esModule",{value:!0}),n.getIdb=l,n.createDatabase=d,n.writeMessage=f,n.getAllMessages=function(e){var t=e.transaction(c).objectStore(c),r=[];return new Promise(function(n){t.openCursor().onsuccess=function(e){var t=e.target.result;t?(r.push(t.value),t.continue()):n(r)}})},n.getMessagesHigherThen=p,n.removeMessageById=h,n.getOldMessages=m,n.cleanOldMessages=v,n.create=b,n.close=w,n.postMessage=_,n.onMessage=y,n.canBeUsed=k,n.averageResponseTime=M,n.default=n.type=n.microSeconds=void 0;var o=e("../util.js"),i=r(e("../oblivious-set")),s=e("../options"),a=o.microSeconds;n.microSeconds=a;var u="pubkey.broadcast-channel-0-",c="messages";function l(){return"undefined"!=typeof indexedDB?indexedDB:void 0!==window.mozIndexedDB?window.mozIndexedDB:void 0!==window.webkitIndexedDB?window.webkitIndexedDB:void 0!==window.msIndexedDB&&window.msIndexedDB}function d(e){var t=l(),n=u+e,r=t.open(n,1);return r.onupgradeneeded=function(e){e.target.result.createObjectStore(c,{keyPath:"id",autoIncrement:!0})},new Promise(function(e,t){r.onerror=function(e){return t(e)},r.onsuccess=function(){e(r.result)}})}function f(e,t,n){var r={uuid:t,time:(new Date).getTime(),data:n},o=e.transaction([c],"readwrite");return new Promise(function(e,t){o.oncomplete=function(){return e()},o.onerror=function(e){return t(e)},o.objectStore(c).add(r)})}function p(e,t){var r=e.transaction(c).objectStore(c),o=[],i=IDBKeyRange.bound(t+1,1/0);return new Promise(function(n){r.openCursor(i).onsuccess=function(e){var t=e.target.result;t?(o.push(t.value),t.continue()):n(o)}})}function h(e,t){var n=e.transaction([c],"readwrite").objectStore(c).delete(t);return new Promise(function(e){n.onsuccess=function(){return e()}})}function m(e,t){var o=(new Date).getTime()-t,n=e.transaction(c).objectStore(c),i=[];return new Promise(function(r){n.openCursor().onsuccess=function(e){var t=e.target.result;if(t){var n=t.value;if(!(n.time<o))return void r(i);i.push(n),t.continue()}else r(i)}})}function v(t,e){return m(t,e).then(function(e){return Promise.all(e.map(function(e){return h(t,e.id)}))})}function b(n,r){return r=(0,s.fillOptionsWithDefaults)(r),d(n).then(function(e){var t={closed:!1,lastCursorId:0,channelName:n,options:r,uuid:(0,o.randomToken)(10),eMIs:new i.default(2*r.idb.ttl),writeBlockPromise:Promise.resolve(),messagesCallback:null,readQueuePromises:[],db:e};return function e(t){if(t.closed)return;return g(t).then(function(){return(0,o.sleep)(t.options.idb.fallbackInterval)}).then(function(){return e(t)})}(t),t})}function g(t){return t.closed?Promise.resolve():t.messagesCallback?p(t.db,t.lastCursorId).then(function(e){return e.filter(function(e){return!!e}).map(function(e){return e.id>t.lastCursorId&&(t.lastCursorId=e.id),e}).filter(function(e){return function(e,t){return e.uuid!==t.uuid&&(!t.eMIs.has(e.id)&&!(e.data.time<t.messagesCallbackTime))}(e,t)}).sort(function(e,t){return e.time-t.time}).forEach(function(e){t.messagesCallback&&(t.eMIs.add(e.id),t.messagesCallback(e.data))}),Promise.resolve()}):Promise.resolve()}function w(e){e.closed=!0,e.db.close()}function _(e,t){return e.writeBlockPromise=e.writeBlockPromise.then(function(){return f(e.db,e.uuid,t)}).then(function(){0===(0,o.randomInt)(0,10)&&v(e.db,e.options.idb.ttl)}),e.writeBlockPromise}function y(e,t,n){e.messagesCallbackTime=n,e.messagesCallback=t,g(e)}function k(){return!o.isNode&&!!l()}function M(e){return 2*e.idb.fallbackInterval}var P={create:b,close:w,onMessage:y,postMessage:_,canBeUsed:k,type:n.type="idb",averageResponseTime:M,microSeconds:a};n.default=P},{"../oblivious-set":11,"../options":12,"../util.js":13,"@babel/runtime/helpers/interopRequireDefault":14}],8:[function(e,t,n){"use strict";var r=e("@babel/runtime/helpers/interopRequireDefault");Object.defineProperty(n,"__esModule",{value:!0}),n.getLocalStorage=l,n.storageKey=d,n.postMessage=f,n.addStorageEventListener=p,n.removeStorageEventListener=h,n.create=m,n.close=v,n.onMessage=b,n.canBeUsed=g,n.averageResponseTime=w,n.default=n.type=n.microSeconds=void 0;var i=r(e("../oblivious-set")),s=e("../options"),a=e("../util"),o=a.microSeconds;n.microSeconds=o;var u="pubkey.broadcastChannel-",c="localstorage";function l(){var e;if("undefined"==typeof window)return null;try{e=window.localStorage,e=window["ie8-eventlistener/storage"]||window.localStorage}catch(e){}return e}function d(e){return u+e}function f(i,s){return new Promise(function(o){(0,a.sleep)().then(function(){var e=d(i.channelName),t={token:(0,a.randomToken)(10),time:(new Date).getTime(),data:s,uuid:i.uuid},n=JSON.stringify(t);l().setItem(e,n);var r=document.createEvent("Event");r.initEvent("storage",!0,!0),r.key=e,r.newValue=n,window.dispatchEvent(r),o()})})}function p(e,t){function n(e){e.key===r&&t(JSON.parse(e.newValue))}var r=d(e);return window.addEventListener("storage",n),n}function h(e){window.removeEventListener("storage",e)}function m(e,t){if(t=(0,s.fillOptionsWithDefaults)(t),!g())throw new Error("BroadcastChannel: localstorage cannot be used");var n=(0,a.randomToken)(10),r=new i.default(t.localstorage.removeTimeout),o={channelName:e,uuid:n,eMIs:r};return o.listener=p(e,function(e){o.messagesCallback&&e.uuid!==n&&e.token&&!r.has(e.token)&&(e.data.time&&e.data.time<o.messagesCallbackTime||(r.add(e.token),o.messagesCallback(e.data)))}),o}function v(e){h(e.init_listener)}function b(e, t, n){e.messagesCallbackTime=n,e.messagesCallback=t}function g(){if(a.isNode)return!1;var e=l();if(!e)return!1;try{var t="__broadcastchannel_check";e.setItem(t,"works"),e.removeItem(t)}catch(e){return!1}return!0}function w(){return 120}var _={create:m,close:v,onMessage:b,postMessage:f,canBeUsed:g,type:n.type=c,averageResponseTime:w,microSeconds:o};n.default=_},{"../oblivious-set":11,"../options":12,"../util":13,"@babel/runtime/helpers/interopRequireDefault":14}],9:[function(e, t, n){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n.create=i,n.close=s,n.postMessage=a,n.onMessage=u,n.canBeUsed=c,n.averageResponseTime=l,n.default=n.type=n.microSeconds=void 0;var r=e("../util"),o=r.microSeconds;n.microSeconds=o;function i(e){var t={messagesCallback:null,bc:new BroadcastChannel(e),subFns:[]};return t.bc.onmessage=function(e){t.messagesCallback&&t.messagesCallback(e.data)},t}function s(e){e.bc.close(),e.subFns=[]}function a(e,t){e.bc.postMessage(t,!1)}function u(e,t){e.messagesCallback=t}function c(){if(r.isNode&&"undefined"==typeof window)return!1;if("function"!=typeof BroadcastChannel)return!1;if(BroadcastChannel._pubkey)throw new Error("BroadcastChannel: Do not overwrite window.BroadcastChannel with this module, this is not a polyfill");return!0}function l(){return 100}var d={create:i,close:s,onMessage:u,postMessage:a,canBeUsed:c,type:n.type="native",averageResponseTime:l,microSeconds:o};n.default=d},{"../util":13}],10:[function(e,t,n){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n.create=s,n.close=a,n.postMessage=u,n.onMessage=c,n.canBeUsed=l,n.averageResponseTime=d,n.default=n.type=n.microSeconds=void 0;var r=e("../util").microSeconds;n.microSeconds=r;var o="simulate";n.type=o;var i=new Set;function s(e){var t={name:e,messagesCallback:null};return i.add(t),t}function a(e){i.delete(e)}function u(t,n){return new Promise(function(e){return setTimeout(function(){Array.from(i).filter(function(e){return e.name===t.name}).filter(function(e){return e!==t}).filter(function(e){return!!e.messagesCallback}).forEach(function(e){return e.messagesCallback(n)}),e()},5)})}function c(e,t){e.messagesCallback=t}function l(){return!0}function d(){return 5}var f={create:s,close:a,onMessage:c,postMessage:u,canBeUsed:l,type:o,averageResponseTime:d,microSeconds:r};n.default=f},{"../util":13}],11:[function(e,t,n){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n.default=void 0;function s(){return(new Date).getTime()}function r(r){var o=new Set,i=new Map;this.has=o.has.bind(o),this.add=function(e){i.set(e,s()),o.add(e),function(){var e=s()-r,t=o[Symbol.iterator]();for(;;){var n=t.next().value;if(!n)return;if(!(i.get(n)<e))return;i.delete(n),o.delete(n)}}()},this.clear=function(){o.clear(),i.clear()}}n.default=r},{}],12:[function(e,t,n){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n.fillOptionsWithDefaults=function(e){e=e||{};void 0===(e=JSON.parse(JSON.stringify(e))).webWorkerSupport&&(e.webWorkerSupport=!0);e.idb||(e.idb={});e.idb.ttl||(e.idb.ttl=45e3);e.idb.fallbackInterval||(e.idb.fallbackInterval=150);e.localstorage||(e.localstorage={});e.localstorage.removeTimeout||(e.localstorage.removeTimeout=6e4);e.node||(e.node={});e.node.ttl||(e.node.ttl=12e4);void 0===e.node.useFastPath&&(e.node.useFastPath=!0);return e}},{}],13:[function(e,t,o){(function(e){"use strict";Object.defineProperty(o,"__esModule",{value:!0}),o.isPromise=function(e){return!(!e||"function"!=typeof e.then)},o.sleep=function(t){t=t||0;return new Promise(function(e){return setTimeout(e,t)})},o.randomInt=function(e,t){return Math.floor(Math.random()*(t-e+1)+e)},o.randomToken=function(e){e=e||5;for(var t="",n="abcdefghijklmnopqrstuvwxzy0123456789",r=0;r<e;r++)t+=n.charAt(Math.floor(Math.random()*n.length));return t},o.microSeconds=function(){var e=(new Date).getTime();return e===t?1e3*e+ ++n:(n=0,1e3*(t=e))},o.isNode=void 0;var t=0,n=0;var r="[object process]"===Object.prototype.toString.call(void 0!==e?e:0);o.isNode=r}).call(this,e("_process"))},{_process:17}],14:[function(e,t,n){t.exports=function(e){return e&&e.__esModule?e:{default:e}}},{}],15:[function(e,t,n){},{}],16:[function(e,t,n){t.exports=!1},{}],17:[function(e,t,n){var r,o,i=t.exports={};function s(){throw new Error("setTimeout has not been defined")}function a(){throw new Error("clearTimeout has not been defined")}function u(t){if(r===setTimeout)return setTimeout(t,0);if((r===s||!r)&&setTimeout)return r=setTimeout,setTimeout(t,0);try{return r(t,0)}catch(e){try{return r.call(null,t,0)}catch(e){return r.call(this,t,0)}}}!function(){try{r="function"==typeof setTimeout?setTimeout:s}catch(e){r=s}try{o="function"==typeof clearTimeout?clearTimeout:a}catch(e){o=a}}();var c,l=[],d=!1,f=-1;function p(){d&&c&&(d=!1,c.length?l=c.concat(l):f=-1,l.length&&h())}function h(){if(!d){var e=u(p);d=!0;for(var t=l.length;t;){for(c=l,l=[];++f<t;)c&&c[f].run();f=-1,t=l.length}c=null,d=!1,function(t){if(o===clearTimeout)return clearTimeout(t);if((o===a||!o)&&clearTimeout)return o=clearTimeout,clearTimeout(t);try{o(t)}catch(e){try{return o.call(null,t)}catch(e){return o.call(this,t)}}}(e)}}function m(e,t){this.fun=e,this.array=t}function v(){}i.nextTick=function(e){var t=new Array(arguments.length-1);if(1<arguments.length)for(var n=1;n<arguments.length;n++)t[n-1]=arguments[n];l.push(new m(e,t)),1!==l.length||d||u(h)},m.prototype.run=function(){this.fun.apply(null,this.array)},i.title="browser",i.browser=!0,i.env={},i.argv=[],i.version="",i.versions={},i.on=v,i.addListener=v,i.once=v,i.off=v,i.removeListener=v,i.removeAllListeners=v,i.emit=v,i.prependListener=v,i.prependOnceListener=v,i.listeners=function(e){return[]},i.binding=function(e){throw new Error("process.binding is not supported")},i.cwd=function(){return"/"},i.chdir=function(e){throw new Error("process.chdir is not supported")},i.umask=function(){return 0}},{}],18:[function(e,t,n){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n.default=void 0;var r={add:function(e){if("function"==typeof WorkerGlobalScope&&self instanceof WorkerGlobalScope);else{if("function"!=typeof window.addEventListener)return;window.addEventListener("beforeunload",function(){e()},!0),window.addEventListener("unload",function(){e()},!0)}}};n.default=r},{}],19:[function(e,t,n){"use strict";var r=e("@babel/runtime/helpers/interopRequireDefault");Object.defineProperty(n,"__esModule",{value:!0}),n.add=l,n.runAll=d,n.removeAll=f,n.getSize=p,n.default=void 0;var o=r(e("detect-node")),i=r(e("./browser.js")),s=r(e("./node.js")),a=o.default?s.default:i.default,u=new Set,c=!1;function l(e){if(c||(c=!0,a.add(d)),"function"!=typeof e)throw new Error("Listener is no function");return u.add(e),{remove:function(){return u.delete(e)},run:function(){return u.delete(e),e()}}}function d(){var t=[];return u.forEach(function(e){t.push(e()),u.delete(e)}),Promise.all(t)}function f(){u.clear()}function p(){return u.size}var h={add:l,runAll:d,removeAll:f,getSize:p};n.default=h},{"./browser.js":18,"./node.js":15,"@babel/runtime/helpers/interopRequireDefault":14,"detect-node":16}]},{},[1]);