Hash = function() {};
Hash.prototype = {
  extend: function(o) {
    for (var k in o)
      this[k] = o[k];
    return this;
  },
  forEach: function(f, o) {
    for (var k in this)
      if (this.hasOwnProperty(k))
	f.call(o, k, this[k], this);
  },
  map: function(f, o) {
    var r = [];
    this.forEach(function() { r.push(f.apply(o, arguments)); });
    return r;
  },
  filter: function(f, o) {
    var r = {};
    this.forEach(function(k, v) { if (f.apply(o, arguments)) r[k] = v; });
    return r;
  },
  reduce: function(r, f, o) {
    this.forEach(function() {
      Array.unshift(arguments, r); r = f.apply(o, arguments); });
    return r;
  },
  query: function() {
    return this.map(function(k, v) { return k + '=' + escape(v); }).join('&');
  }
};

Function.prototype.__proto__ = {
  bind: function(o) {
    var f = this;
    return function() { return f.apply(o, arguments); };
  },
  bless: (function(g) {
    var seq = 0;
    return function(o) {
      var self = this, name = '__bLs' + seq++;
      var f = eval('(g[name] = function ' + name
        + '() {return self.apply(o, arguments)})');
      f.curse = function() { delete g[name]; };
      return f;
    };
  })(this),
  __noSuchMethod__: function(name, args) {
    return this.prototype[name].apply(args.shift(), args);
  }
};

Array.prototype.__proto__ = {
  __proto__: Hash.prototype,
  invoke: function(name, args) {
    args = args || [];
    return this.map(function(v) { return v[name].apply(v, args); });
  },
  indexOf: function(item) {
    for (var i = 0, n = this.length; i < n; i++)
      if (this[i] === item)
        return i;
    return -1;
  },
  remove: function(item) {
    for (var i = 0, n = this.length; i < n; i++)
      if (this[i] === item)
        this.splice(i, 1);
  },
  get last() {
    return this[this.length - 1];
  }
};

String.prototype.__proto__ = {
  __proto__: Hash.prototype,
  bind: function(o) {
    var f = o[this];
    return function() { return f.apply(o, arguments); };
  },
  fill: function(o) {
    return this.replace(/\#\{(.*?)\}/g, function(_, name) { return o[name]; });
  },
  thaw: function() {
    try { return eval('(' + this + ')'); } catch(e) { return e; }
  },
  get chars() {
    return this.match(/([\x00-\x7f]|[\xc2-\xfd][\x80-\xbf]+)/g);
  }
};

Number.prototype.__proto__ = {
  __proto__: Hash.prototype,
  forEach: function(f, o) {
    for (var i = 0; i < this; i++)
      f.call(o, i, this);
  }
};

XMLDOM.prototype.__proto__ = {
  __proto__: Hash.prototype,
  elem: XMLDOM.prototype.getElementsByTagName,
  attr: XMLDOM.prototype.getAttribute,
  text: function(name) {
    return this.elem(name).join('');
  },
  toString: function() {
    return this.nodeName.charAt(0) == '#'
      ? this.nodeValue : this.childNodes.join('');
  }
};

Observable = function() { this._observers = []; };
Observable.prototype = {
  __proto__: Hash.prototype,
  observe: function(o, caller) {
    var caller = caller || o;
    var list = this._observers;
    var func = typeof o == 'function' ? o.bind(caller)
      : function(type, args) { if (o[type]) o[type].apply(caller, args); };
    list.push(func);
    return function() { list.remove(func); };
  },
  signal: function(type, args) {
    this._observers.forEach(function(f) { f(type, args); });
  }
};

System = {
  event: new Observable,
  input: new Observable
};
'onLoad onFocus onUnfocus onActivate'.split(' ').forEach(function(s) {
  this[s] = function() { System.event.signal(s); };
}, this);
'onConfirmKey onUpKey onDownKey onLeftKey onRightKey onBlueKey onRedKey onGreenKey onYellowKey'.split(' ').forEach(function(s) {
  this[s] = function(type) {
    System.input.signal(s + (type ? 'Released' : 'Pressed'));
    System.input.signal(s, type);
  };
}, this);

Node = function(node) {
  Observable.call(this);
  this._node = node;
};
Node.prototype = {
  __proto__: Observable.prototype,
  _call: function(f, args) {
    var ary = [this._node];
    ary.push.apply(ary, args);
    return f.apply(null, ary);
  },
  _set: function(f, k, v) {
    if (this._node[k] != v) f(this._node, (this._node[k] = v)); return v;
  },
  _get: function(f, k) {
    return k in this._node ? this._node[k] : (this._node[k] = f(this._node));
  },
  setStr: function(v) {
    delete this._node.lines;
    this._set(setStr, 'str', v.toString());
  },
  setVisible: function(v) {
    this._set(setVisible, 'visible', v ? 1 : 0);
  },
  loadImage: function() {
    delete this._node.w;
    delete this._node.h;
    this._call(loadImage, arguments);
  },
  child: function(name, klass) {
    var n = new (klass || Node)(getChildNode(this._node, name));
    n.parentNode = this;
    return n;
  },
  set str(v) {
    return this.setStr(v);
  },
  set visible(v) {
    return this.setVisible(v);
  },
  set image(v) {
    return this.loadImage(v);
  },
  show: function() {
    this.setVisible(1);
  },
  hide: function() {
    this.setVisible(0);
  },
  notify: function(type, args) {
    if (this[type])
      this[type].apply(this, args);
    else if (this.parentNode)
      this.parentNode.notify(type, args);
  },
  focus: function() {
    Node.focusNode.onInputBlur();
    Node.focusNode = this;
    this.onInputFocus();
  },
  onInputFocus: function() {},
  onInputBlur: function() {}
};

Hash.forEach({ x:getPosX, y:getPosY, w:getW, h:getH, str:getStr, visible:isVisible, rgb:getRGB, alpha:getAlpha, scaleX:getScaleX, scaleY:getScaleY, name:getName, lines:getLines }, function(k, f) {
  Node.prototype[f.name] = function() { return this._get(f, k); };
  Node.prototype.__defineGetter__(k, function() { return this[f.name](); });
});

Hash.forEach({ x:setPosX, y:setPosY, w:setW, h:setH, /* str:setStr, visible:setVisible, */ rgb:setRGB, alpha:setAlpha, scaleX:setScaleX, scaleY:setScaleY }, function(k, f) {
  Node.prototype[f.name] = function(v) { return this._set(f, k, v); };
  Node.prototype.__defineSetter__(k, function(v) { return this[f.name](v); });
});

[isImageLoaded, destroyImage, pageDown, pageUp, lineDown, lineUp].forEach(function(f) {
  Node.prototype[f.name] = function() { return this._call(f, arguments); };
});

Node.focusNode = new Node(getRootNode());

System.input.observe(function(type, args) {
  Node.focusNode.notify(type, args);
});

Slider = function() { Node.apply(this, arguments); };
Slider.prototype = {
  __proto__: Node.prototype,
  size: 1,
  direction: 'horizontal',
  _traits: {horizontal:{pos:'x', size:'w'}, vertical:{pos:'y', size:'h'}},
  update: function(param) { // size, count, pos
    this.extend(param || {});
    this.size = Math.min(this.size, this.count);
    this.pos = Math.min(this.pos, this.count - this.size);
    var t = this._traits[this.direction];
    var sz1 = this[t.size];
    var sz2 = this.count ? sz1 * this.size / this.count : sz1;
    var step = this.count - this.size;
    var pos = step ? (sz1 - sz2) * (this.pos / step - 0.5) : 0;
    this.thumbNode[t.size] = sz2;
    this.thumbNode[t.pos] = pos;
  }
};

HTTP = function() {
  Observable.call(this);
  this.xhr = new XMLHttpRequest();
  this.xhr._owner = this;
  this.xhr.onreadystatechange = function() {
    if (this.readyState == 4)
      this._owner._complete();
  };
};
HTTP.prototype = {
  __proto__: Observable.prototype,
  _sentq: [],
  _waitq: [],
  _max: 3,
  _pump: function() {
    while (this._sentq.length < this._max && this._waitq.length > 0) {
      var req = this._waitq.shift();
      this._sentq.push(req);
      req._send();
    }
  },
  _remove: function() {
    this._waitq.remove(this);
    this._sentq.remove(this);
    this.xhr.onreadystatechange = function() {};
  },
  _complete: function() {
    this._remove();
    this.signal(this.success ? 'onSuccess' : 'onFailure', [this.xhr]);
    this.signal('onComplete', [this.xhr]);
    this._pump();
  },
  get success() {
    return this.xhr.status >= 200 && this.xhr.status < 300;
  },
  abort: function() {
    this.xhr.abort();
    this._remove();
    this._pump();
  },
  send: function(body) {
    var xhr = this.xhr;
    this._send = function() { xhr.send(body); };
    this._waitq.push(this);
    this._pump();
  },
  __noSuchMethod__: function(name, args) {
    return this.xhr[name].apply(this.xhr, args);
  }
};

HTTP.get = function(url) {
  var req = new HTTP;
  req.open('GET', url, true);
  req.send(null);
  return req;
};


//////////////////////////////////////////////////////////////////////////////
String.prototype.unescape = function() {
  return this.replace(/<.*?>/g, '').replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<');
}

Iterator = function(ary) {
  this.ary = ary;
  this.index = 0;
}
Iterator.prototype = {
  get current() { return this.ary[this.index] },
  get hasNext() { return this.index < this.ary.length - 1 },
  get hasPrev() { return this.index > 0 },
  next: function() {
    this.index = (this.index + 1) % this.ary.length;
    return this.ary[this.index];
  },
  prev: function() {
    this.index = (this.index + this.ary.length - 1) % this.ary.length;
    return this.ary[this.index]
  }
}

FrameList = function() {
  Node.apply(this, arguments);
}
FrameList.prototype = {
  __proto__: Node.prototype,
  update: function(param) {
    this.extend(param || {});
    var top = 0;
    this.hide();
    this.itemNodes.forEach(function(node, i) {
      var item = this.items[i];
      if (item) {
	this.notify('onDrawItem', [node, item]);
	node.y = top + node.h / 2;
	top += node.h;
	node.show();
      } else {
	node.hide();
      }
    }, this);
    this.show();
    this.scrollTop = 0;
    this.selectedIndex = 0;
    this.notify('onSelectItem');
  },
  selectedIndex: 0,
  get selectedData() {
    return this.items[this.selectedIndex];
  },
  get selectedNode() {
    return this.itemNodes[this.selectedIndex];
  },
  get itemCount() {
    return Math.min(this.items.length, this.itemNodes.length);
  },
  get hasNext() {
    return this.selectedIndex < this.itemCount - 1;
  },
  get hasPrev() {
    return this.selectedIndex > 0;
  },
  adjust: function() {
    var node = this.selectedNode;
    if (this.y + node.y - node.h / 2 < - this.h / 2) // top
      this.y = - node.y - (this.h - node.h) / 2;
    else if (this.y + node.y + node.h / 2 > this.h / 2) // bottom
      this.y = - node.y + (this.h - node.h) / 2;
  },
  next: function() {
    if (this.hasNext) {
      this.selectedIndex++;
      this.adjust();
      this.notify('onSelectItem');
    }
  },
  prev: function() {
    if (this.hasPrev) {
      this.selectedIndex--;
      this.adjust();
      this.notify('onSelectItem');
    }
  },
  get scrollTop() {
    return - this.y - this.h / 2;
  },
  set scrollTop(v) {
    this.y = v - this.h / 2;
    return v;
  },
  get clientHeight() {
    if (this.itemCount == 0)
      return 0;
    var first = this.itemNodes[0];
    var last  = this.itemNodes[this.itemCount - 1];
    return last.y - first.y + (first.h + last.h) / 2;
  }
}

//////////////////////////////////////////////////////////////////////////////
App = {}

App.SearchProvider = [];

App.SearchProvider.Google = {
  search: function(query) {
    var req = HTTP.get(this.api + escape(query));
    req.observe({
      onSuccess: function(xhr) {
	var result = xhr.responseText.thaw().responseData.results.map(function(item, i) {
	  return {
	    index: i,
	    title: item.titleNoFormatting.unescape(),
	    desc: item.content.unescape(),
	    link: unescape(item.url || item.postUrl)
	  }
	});
	req.signal('onQueryResult', [result]);
      }
    });
    return req;
  }
}

App.SearchProvider.push({
  __proto__: App.SearchProvider.Google,
  name: 'Googleウェブ検索',
  api: 'http://ajax.googleapis.com/ajax/services/search/web?v=1.0&rsz=large&q='
});

App.SearchProvider.push({
  __proto__: App.SearchProvider.Google,
  name: 'Googleブログ検索',
  api: 'http://ajax.googleapis.com/ajax/services/search/blogs?v=1.0&rsz=large&q='
});

App.SearchProvider.push({
  __proto__: App.SearchProvider.Google,
  name: 'Googleニュース検索',
  api: 'http://ajax.googleapis.com/ajax/services/search/news?v=1.0&hl=ja&rsz=small&q='
});

App.SearchProvider.push({
  name: 'Yahoo!ウェブ検索',
  api: 'http://api.search.yahoo.co.jp/WebSearchService/V1/webSearch?appid=XvKhGVKxg65oPOThEftp6dDEuJ8mrOYw_jm6JCc.Mg_bSEiwsJkhDucbcZb6_Y.lCBIiIgeSGHDTU1zwOuc-&query=',
  search: function(query) {
    var req = HTTP.get(this.api + escape(query));
    req.observe({
      onSuccess: function(xhr) {
	var result = xhr.responseXML.elem('Result').map(function(res, i) {
	  return {
	    index: i,
	    title: res.text('Title'),
	    desc:  res.text('Summary').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
	    link:  res.elem('Url')[0].toString()
	  }
	});
	req.signal('onQueryResult', [result]);
      }
    });
    return req;
  }
});

/*
App.SearchProvider.push({
  name: 'Yahoo!ブログ検索',
  api: 'http://blog-search.yahoo.co.jp/rss?p=',
  search: function(query) {
    var req = HTTP.get(this.api + escape(query));
    req.observe({
      onSuccess: function(xhr) {
	var result = xhr.responseXML.elem('item').map(function(item, i) {
	  return {
	    index: i,
	    title: item.text('title'),
	    desc:  item.text('description'),
	    link:  item.text('link')[0].toString()
	  }
	});
	req.signal('onQueryResult', result);
      }
    });
    return req;
  }
});

App.SearchProvider.push({
  name: 'Wikipedia',
  api: 'http://wikipedia.simpleapi.net/api?output=xml&keyword=',
  search: function(query) {
    var req = HTTP.get(this.api + escape(query));
    req.observe({
      onSuccess: function(xhr) {
	var result = xhr.responseXML.elem('result').map(function(res, i) {
	  return {
	    index: i,
	    title: res.text('title'),
	    desc:  res.text('body').replace(/<br\/>/g, '\n'),
	    link:  res.text('url')
	  }
	});
	req.signal('onQueryResult', [result]);
      }
    });
    return req;
  }
});
*/

App.SearchProvider.push({
  name: 'はてなブックマーク',
  api: 'http://b.hatena.ne.jp/keyword/#{query}?mode=rss&sort=count',
  search: function(query) {
    var req = HTTP.get(this.api.fill({query:escape(query)}));
    req.observe({
      onSuccess: function(xhr) {
	var result = xhr.responseXML.elem('item').map(function(item, i) {
	  return {
	    index: i,
	    title: item.text('title'),
	    desc:  item.text('description'),
	    link:  item.text('link')[0].toString()
	  }
	});
	req.signal('onQueryResult', [result]);
      }
    });
    return req;
  }
});

//////////////////////////////////////////////////////////////////////////////
App.ServiceSelect = function() {
  Node.apply(this, arguments);
  this.focused = this.child('focused');
  this.text = this.child('text');
  this.child('prev').loadImage('img/prev.png');
  this.child('next').loadImage('img/next.png');
}
App.ServiceSelect.prototype = {
  __proto__: Node.prototype,
  update: function(param) {
    this.extend(param || {});
    this.text.str = this.items.current.name;
  },
  onInputFocus: function() {
    this.focused.show();
  },
  onInputBlur: function() {
    this.focused.hide();
  },
  onLeftKeyPressed: function() {
    this.items.prev();
    this.update();
    this.notify('onQueryChanged');
  },
  onRightKeyPressed: function() {
    this.items.next();
    this.update();
    this.notify('onQueryChanged');
  }
}

App.KeywordInput = function() {
  Node.apply(this, arguments);
  this.focused = this.child('focused');
  this.text = this.child('text');
  this.hint = this.child('hint');
  this.tooltip = this.child('tooltip');
  this.child('icon').loadImage('img/keyboard.png');
  this.child('tip').loadImage('img/tip.png');
}
App.KeywordInput.prototype = {
  __proto__: Node.prototype,
  get value() {
    return this.text.str;
  },
  set value(v) {
    this.hint.visible = !v;
    this.tooltip.visible = !v;
    return this.text.str = v;
  },
  onInputFocus: function() {
    this.focused.show();
    this.tooltip.visible = !this.value;
    this.hint.hide();
  },
  onInputBlur: function() {
    this.focused.hide();
    this.tooltip.hide();
    this.hint.visible = !this.value;
  },
  onConfirmKeyPressed: function() {
    var query = prompt('', this.value || '', false);
    if (query) {
      this.value = query;
      this.notify('onQueryChanged', [query]);
    }
  }
}

App.Scrollbar = function() {
  Slider.apply(this, arguments);
  this.thumbNode = this.child('thumb');
  this.thumbNode.extend({
    bg: this.thumbNode.child('bg'),
    fg: this.thumbNode.child('fg'),
    setH: function(h) { this.bg.h = this.fg.h = h }
  });
}
App.Scrollbar.prototype = {
  __proto__: Slider.prototype,
  direction: 'vertical'
}

App.ResultList = function() {
  FrameList.apply(this, arguments);
  this.itemNodes = (10).map(function(i) {
    var item = this.child('item' + i);
    item.title = item.child('title').extend({ lineHeight:16+4 });
    item.desc = item.child('desc').extend({ lineHeight:14+4 });
    return item;
  }, this);
  this.selectorNode = this.child('selector');
}
App.ResultList.prototype = {
  __proto__: FrameList.prototype,
  onSelectItem: function() {
    if (!this.selectedNode)
      return;
    this.selectorNode.y = this.selectedNode.y;
    this.selectorNode.h = this.selectedNode.h;
    this.scrollbar.update({
      count:this.clientHeight,
      size:this.h,
      pos:this.scrollTop
    });
    this.scrollbar.show();
  },
  onDrawItem: function(node, item) {
    if (item) {
      node.title.str = item.title;
      node.desc.str = item.desc;
    } else {
      node.title.str = node.desc.str = '';
    }

    node.title.h = node.title.lines * node.title.lineHeight;
    node.desc.h = Math.min(node.desc.lines * node.desc.lineHeight,
			   this.h - node.title.h - 5);
    node.h = node.title.h + node.desc.h + 5;
    node.title.y = node.h / -2;
    node.desc.y = node.title.y + node.title.h;
  },
  onDownKeyPressed: function() {
    if (this.hasNext)
      this.next();
    else if (this.parentNode)
      this.parentNode.notify('onDownKeyPressed');
  },
  onUpKeyPressed: function() {
    if (this.hasPrev)
      this.prev();
    else if (this.parentNode)
      this.parentNode.notify('onUpKeyPressed');
  },
  onConfirmKeyPressed: function() {
    execBrowser(this.selectedData.link);
  },
  onInputFocus: function() {
    this.selectorNode.show();
  },
  onInputBlur: function() {
    this.selectorNode.hide();
  }
}

//////////////////////////////////////////////////////////////////////////////
App.Controller = function() {
  Node.call(this, getRootNode());
  System.event.observe(this);
  this.focus();
}
App.Controller.prototype = {
  __proto__: Node.prototype,
  onLoad: function() {
    this.provider = new Iterator(App.SearchProvider);
    var name = getRegistry('Item1');
    if (name) App.SearchProvider.forEach(function(sp, i) {
      if (name == sp.name)
	this.provider.index = i;
    }, this);
    this.service = this.child('service', App.ServiceSelect);
    this.service.update({items:this.provider});
    this.loading = this.child('loading');
  },
  onFocus: function() {
    this.service.focus();
  },
  onUnfocus: function() {
    this.focus()
  },
  onActivate: function() {
    this.keyword = this.child('keyword', App.KeywordInput);
    this.views = new Iterator([this.service, this.keyword]);
    this.views.next();
    this.views.current.focus();
    this.child('head').y = -215;
    this.child('body').show();
  },
  onLeftKeyPressed: function() {
    this.service.notify('onLeftKeyPressed');
  },
  onRightKeyPressed: function() {
    this.service.notify('onRightKeyPressed');
  },
  onUpKeyPressed: function() {
    if (this.views && this.views.hasPrev) {
      this.views.prev();
      this.views.current.focus();
    }
  },
  onDownKeyPressed: function() {
    if (this.views && this.views.hasNext) {
      this.views.next();
      this.views.current.focus();
    }
  },
  onQueryChanged: function(query) {
    setRegistry('Item1', this.provider.current.name);
    if (this.keyword && this.keyword.value) {
      this.loading.show();
      this.provider.current.search(this.keyword.value).observe(this);
    }
  },
  onQueryResult: function(result) {
    if (!this.list) {
      this.list = this.child('result', App.ResultList);
      this.list.scrollbar = this.child('scrollbar', App.Scrollbar);
      this.list.show();
      this.views.ary.push(this.list);
    }
    this.list.update({items:result});
    this.loading.hide();
  }
}

new App.Controller;
