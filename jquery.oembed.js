/*!
 * jquery oembed plugin
 *
 * Copyright (c) 2009 Richard Chamorro
 * Licensed under the MIT license
 *
 * Orignal Author: Richard Chamorro
 * Forked by Andrew Mee to Provide a slightly diffent kind of embedding
 * experience
 */
(function ($) {
	var $jqoembeddata = $('#jqoembeddata');
	$.fn.oembed = function (url, options, embedAction) {

		settings = $.extend(true, $.fn.oembed.defaults, options);

		$.fn.oembed.providers = [];
		$.each(settings.oembedProviders, function () {
			$.fn.oembed.providers.push(new $.fn.oembed.OEmbedProvider(this[0], this[1], this[2], this[3], this[4]));
		});

		if ($jqoembeddata.length === 0) {
			$jqoembeddata = $('<span id="jqoembeddata"></span>');
			$jqoembeddata.appendTo('body');
		}

		return this.each(function () {

			var container = $(this),
				resourceURL = (url && /^(https?\:)?\/\//.test(url)) ? url : container.attr("href"),
				provider;

			if (embedAction) {
				settings.onEmbed = embedAction;
			} else if (!settings.onEmbed) {
				settings.onEmbed = function (oembedData) {
					$.fn.oembed.insertCode(this, settings.embedMethod, oembedData);
				};
			}

			if (resourceURL !== null && resourceURL !== undefined) {
				//Check if shorten URL
				for (var j = 0, l = settings.shortURLList.length; j < l; j++) {
					var regExp = new RegExp('//' + settings.shortURLList[j] + '/', "i");
					if (resourceURL.match(regExp) !== null) {
						//AJAX to http://api.longurl.org/v2/expand?url=http://bit.ly/JATvIs&format=json&callback=hhh
						var ajaxopts = $.extend({
							url: "//api.longurl.org/v2/expand",
							dataType: 'jsonp',
							data: {
								url: resourceURL,
								format: "json"
								//callback: "?"
							},
							success: function (data) {
								//this = $.fn.oembed;
								resourceURL = data['long-url'];
								provider = $.fn.oembed.getOEmbedProvider(data['long-url']);

								if (provider !== null) {
									provider.params = getNormalizedParams(settings[provider.name]) || {};
									provider.maxWidth = settings.maxWidth;
									provider.maxHeight = settings.maxHeight;
									embedCode(container, resourceURL, provider);
								} else {
									settings.onProviderNotFound.call(container, resourceURL);
								}
							}
						}, settings.ajaxOptions || {}); // function only created once within loop then loop exits

						$.ajax(ajaxopts);

						return container;
					}
				}
				provider = $.fn.oembed.getOEmbedProvider(resourceURL);

				if (provider !== null) {
					provider.params = getNormalizedParams(settings[provider.name]) || {};
					provider.maxWidth = settings.maxWidth;
					provider.maxHeight = settings.maxHeight;
					embedCode(container, resourceURL, provider);
				} else {
					settings.onProviderNotFound.call(container, resourceURL);
				}
			}

			return container;
		});

	};

	var settings;

	// Plugin defaults
	$.fn.oembed.defaults = {
		maxWidth: null,
		maxHeight: null,
		includeHandle: true,

		// template for expand collapse customization
		toggler: '<span class="oembedall-closehide">&darr;</span>',
		togglerDown: "&darr;",
		togglerUp: "&uarr;",

		embedMethod: 'auto',
		// "auto", "append", "fill"		
		onProviderNotFound: function () {},
		beforeEmbed: function () {},
		afterEmbed: function () {},
		onEmbed: false,
		onError: function () {},
		ajaxOptions: {},

		// web service to get urls over HTTP and return them (through HTTPS), e.g. "https://someproxy.com/get?url="
		webProxyService: null,
		// only match specified short url provider regex fragments:
		shortURLList: [ /* "bit\.ly" */ ],
		// only use the providers passed in
		oembedProviders: [
			//["youtube", "video", ["youtube\\.com/watch.+v=[\\w-]+&?", "youtu\\.be/[\\w-]+","youtube.com/embed"], 'http://www.youtube.com/embed/$1?wmode=transparent', {
			//	templateRegex: /.*(?:v\=|be\/|embed\/)([\w\-]+)&?.*/,
			//	embedtag: {tag: 'iframe',width: '425',height: '349'}
			//}]
		]
	};

	/* Private functions */
	//TODO: just use Math.random() instead?
	var rand = function (length, current) { //Found on http://stackoverflow.com/questions/1349404/generate-a-string-of-5-random-characters-in-javascript
		current = current ? current : '';
		return length ? rand(--length, "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz".charAt(Math.floor(Math.random() * 60)) + current) : current;
	},

		getRequestUrl = function (provider, externalUrl) {
			var url = provider.apiendpoint,
				qs = "",
				i;

			url += (url.indexOf("?") <= 0) ? "?" : "&";
			url = url.replace('#', '%23');

			if (provider.maxWidth !== null && (typeof provider.params.maxwidth === 'undefined' || provider.params.maxwidth === null)) {
				provider.params.maxwidth = provider.maxWidth;
			}

			if (provider.maxHeight !== null && (typeof provider.params.maxheight === 'undefined' || provider.params.maxheight === null)) {
				provider.params.maxheight = provider.maxHeight;
			}

			//TODO: use $.each
			for (i in provider.params) {
				if (Object.prototype.hasOwnProperty.call(provider.params, i)) {
					// We don't want them to jack everything up by changing the callback parameter
					if (i === provider.callbackparameter) {
						continue;
					}

					// allows the options to be set to null, don't send null values to the server as parameters
					if (provider.params[i] !== null) {
						qs += "&" + window.encodeURIComponent(i) + "=" + provider.params[i];
					}
				}
			}

			url += "format=" + provider.format + "&url=" + window.encodeURIComponent(externalUrl) + qs;
			if (provider.dataType !== 'json') {
				url += "&" + provider.callbackparameter + "=?";
			}

			url = (settings.webProxyService) ? settings.webProxyService + window.encodeURIComponent(url) : url;

			return url;
		},

		success = function (oembedData, externalUrl, container) {
			$jqoembeddata.data(externalUrl, oembedData.code);
			settings.beforeEmbed.call(container, oembedData);
			settings.onEmbed.call(container, oembedData);
			settings.afterEmbed.call(container, oembedData);
		},

		embedCode = function (container, externalUrl, embedProvider) {
			if ($jqoembeddata.data(externalUrl) !== undefined && $jqoembeddata.data(externalUrl) !== null && embedProvider.embedtag.tag !== 'iframe') {
				var oembedData = {
					code: $jqoembeddata.data(externalUrl)
				};
				success(oembedData, externalUrl, container);
			} else if (embedProvider.yql) {
				var from = embedProvider.yql.from || 'htmlstring';
				var url = embedProvider.yql.url ? embedProvider.yql.url(externalUrl) : externalUrl;
				var query = 'SELECT * FROM ' + from + ' WHERE url="' + (url) + '"' + " and " + (/html/.test(from) ? 'xpath' : 'itemPath') + "='" + (embedProvider.yql.xpath || '/') + "'";
				if (from === 'html') {
					query += " and compat='html5'";
				}
				var ajaxopts = $.extend({
					url: "http://query.yahooapis.com/v1/public/yql",
					dataType: 'jsonp',
					data: {
						q: query,
						format: "json",
						env: 'store://datatables.org/alltableswithkeys',
						callback: "?"
					},
					success: function (data) {
						var result;
						if (embedProvider.yql.xpath && embedProvider.yql.xpath === '//meta|//title|//link') {
							var meta = {};
							if (data.query.results === null) {
								data.query.results = {
									"meta": []
								};
							}
							for (var i = 0, m = data.query.results.meta.length; i < m; i++) {
								var name = data.query.results.meta[i].name || data.query.results.meta[i].property || null;
								if (name === null) {
									continue;
								}
								meta[name.toLowerCase()] = data.query.results.meta[i].content;
							}
							if (!meta.hasOwnProperty("title") || !meta.hasOwnProperty("og:title")) {
								if (data.query.results.title !== null) {
									meta.title = data.query.results.title;
								}
							}
							if (!meta.hasOwnProperty("og:image") && data.query.results.hasOwnProperty("link")) {
								for (var j = 0, l = data.query.results.link.length; j < l; j++) {
									if (data.query.results.link[j].hasOwnProperty("rel")) {
										if (data.query.results.link[j].rel === "apple-touch-icon") {
											if (data.query.results.link[j].href.charAt(0) === "/") {
												meta["og:image"] = url.match(/^(([a-z]+:)?(\/\/)?[^\/]+\/).*$/)[1] + data.query.results.link[j].href;
											} else {
												meta["og:image"] = data.query.results.link[j].href;
											}
										}
									}
								}
							}
							result = embedProvider.yql.datareturn(meta);
						} else {
							result = embedProvider.yql.datareturn ? embedProvider.yql.datareturn(data.query.results) : data.query.results.result;
						}
						if (result === false) {
							return;
						}
						var oembedData = $.extend({}, result);
						oembedData.code = result;
						success(oembedData, externalUrl, container);
					},
					error: settings.onError.call(container, externalUrl, embedProvider)
				}, settings.ajaxOptions || {});

				$.ajax(ajaxopts);
			} else if (embedProvider.templateRegex) {
				if (embedProvider.embedtag.tag !== '') {
					var flashvars = embedProvider.embedtag.flashvars || '';
					var tag = embedProvider.embedtag.tag || 'embed';
					var width = embedProvider.embedtag.width || 'auto';
					// never used?
					//var nocache = embedProvider.embedtag.nocache || 0;
					var height = embedProvider.embedtag.height || 'auto';
					var src = externalUrl.replace(embedProvider.templateRegex, embedProvider.apiendpoint);
					if (!embedProvider.nocache) {
						src += '&jqoemcache=' + rand(5);
					}
					if (embedProvider.apikey) {
						src = src.replace('_APIKEY_', settings.apikeys[embedProvider.name]);
					}

					var code = $('<' + tag + '/>')
						.attr('src', src)
						.attr('width', width)
						.attr('height', height)
						.attr('allowfullscreen', embedProvider.embedtag.allowfullscreen || 'true')
						.attr('allowscriptaccess', embedProvider.embedtag.allowfullscreen || 'always')
						.css('max-height', settings.maxHeight || 'auto')
						.css('max-width', settings.maxWidth || 'auto');
					if (tag === 'embed') {
						code
							.attr('type', embedProvider.embedtag.type || "application/x-shockwave-flash")
							.attr('flashvars', externalUrl.replace(embedProvider.templateRegex, flashvars));
					} else if (tag === 'iframe') {
						code
							.attr('scrolling', embedProvider.embedtag.scrolling || "no")
							.attr('frameborder', embedProvider.embedtag.frameborder || "0");
					}

					success({
						code: code
					}, externalUrl, container);
				} else if (embedProvider.apiendpoint) {
					//Add APIkey if true
					if (embedProvider.apikey) {
						embedProvider.apiendpoint = embedProvider.apiendpoint.replace('_APIKEY_', settings.apikeys[embedProvider.name]);
					}
					$.ajax($.extend({
						url: externalUrl.replace(embedProvider.templateRegex, embedProvider.apiendpoint),
						dataType: 'jsonp',
						success: function (data) {
							var oembedData = $.extend({}, data);
							oembedData.code = embedProvider.templateData(data);
							success(oembedData, externalUrl, container);
						},
						error: settings.onError.call(container, externalUrl, embedProvider)
					}, settings.ajaxOptions || {}));
				} else {
					success({
						code: externalUrl.replace(embedProvider.templateRegex, embedProvider.template)
					}, externalUrl, container);
				}
			} else {

				var requestUrl = getRequestUrl(embedProvider, externalUrl);

				$.ajax($.extend({
					url: requestUrl,
					dataType: embedProvider.dataType || 'jsonp',
					success: function (data) {
						var oembedData = $.extend({}, data);
						switch (oembedData.type) {
						case "file": //Deviant Art has this
						case "photo":
							oembedData.code = $.fn.oembed.getPhotoCode(externalUrl, oembedData);
							break;
						case "video":
						case "rich":
							oembedData.code = $.fn.oembed.getRichCode(externalUrl, oembedData);
							break;
						default:
							oembedData.code = $.fn.oembed.getGenericCode(externalUrl, oembedData);
							break;
						}
						success(oembedData, externalUrl, container);
					},
					error: settings.onError.call(container, externalUrl, embedProvider)
				}, settings.ajaxOptions || {}));
			}
		},

		getNormalizedParams = function (params) {
			if (params === null) {
				return null;
			}
			var key, normalizedParams = {};
			for (key in params) {
				if (Object.prototype.hasOwnProperty.call(params, key) && key !== null) {
					normalizedParams[key.toLowerCase()] = params[key];
				}
			}
			return normalizedParams;
		};

	/* Public functions */
	$.fn.oembed.insertCode = function (container, embedMethod, oembedData) {
		if (oembedData === null) {
			return;
		}
		if (embedMethod === 'auto' && container.attr("href") !== null) {
			embedMethod = 'append';
		} else if (embedMethod === 'auto') {
			embedMethod = 'replace';
		}
		switch (embedMethod) {
		case "replace":
			container.replaceWith(oembedData.code);
			break;
		case "fill":
			container.html(oembedData.code);
			break;
		case "append":
			container.wrap('<div class="oembedall-container"></div>');
			var oembedContainer = container.parent();
			if (settings.includeHandle && settings.toggler) {
				$(settings.toggler).insertBefore(container).click(function () {
					var $span = $(this),
						encodedUp = window.encodeURIComponent($("<i>" + settings.togglerUp + "</i>").text()),
						encodedString = window.encodeURIComponent($span.text());

					$span.html((encodedString === encodedUp) ? settings.togglerDown : settings.togglerUp);
					$span.parent().children().last().toggle();
				});
			}
			oembedContainer.append('<br/>');
			try {
				oembedData.code.clone().appendTo(oembedContainer);
			} catch (e) {
				oembedContainer.append(oembedData.code);
			}
			/* Make videos semi-responsive
			 * If parent div width less than embeded iframe video then iframe gets shrunk to fit smaller width
			 * If parent div width greater thans embed iframe use the max width
			 * - works on youtubes and vimeo
			 */
			if (settings.maxWidth) {
				var post_width = oembedContainer.parent().width();
				var $iframe = $('iframe', oembedContainer);
				if (post_width < settings.maxWidth) {
					var iframe_width_orig = $iframe.width();
					var iframe_height_orig = $iframe.height();
					var ratio = iframe_width_orig / post_width;
					$iframe.width(iframe_width_orig / ratio);
					$iframe.height(iframe_height_orig / ratio);
				} else {
					if (settings.maxWidth) {
						$iframe.width(settings.maxWidth);
					}
					if (settings.maxHeight) {
						$iframe.height(settings.maxHeight);
					}
				}
			}
			break;
		}
	};

	$.fn.oembed.getPhotoCode = function (url, oembedData) {
		var code,
			alt = oembedData.title ? oembedData.title : '';
		alt += oembedData.author_name ? ' - ' + oembedData.author_name : '';
		alt += oembedData.provider_name ? ' - ' + oembedData.provider_name : '';
		if (oembedData.url) {
			code = '<div><a href="' + url + '" target=\'_blank\'><img src="' + oembedData.url + '" alt="' + alt + '"/></a></div>';
		} else if (oembedData.thumbnail_url) {
			var newURL = oembedData.thumbnail_url.replace('_s', '_b');
			code = '<div><a href="' + url + '" target=\'_blank\'><img src="' + newURL + '" alt="' + alt + '"/></a></div>';
		} else {
			code = '<div>Error loading this picture</div>';
		}
		if (oembedData.html) {
			code += "<div>" + oembedData.html + "</div>";
		}
		return code;
	};

	$.fn.oembed.getRichCode = function (url, oembedData) {
		var code = oembedData.html;
		return code;
	};

	$.fn.oembed.getGenericCode = function (url, oembedData) {
		var title = (oembedData.title !== null) ? oembedData.title : url,
			code = '<a href="' + url + '">' + title + '</a>';
		if (oembedData.html) {
			code += "<div>" + oembedData.html + "</div>";
		}
		return code;
	};

	$.fn.oembed.getOEmbedProvider = function (url) {
		for (var i = 0; i < $.fn.oembed.providers.length; i++) {
			for (var j = 0, l = $.fn.oembed.providers[i].urlschemes.length; j < l; j++) {
				var regExp = new RegExp($.fn.oembed.providers[i].urlschemes[j], "i");
				if (url.match(regExp) !== null) {
					return $.fn.oembed.providers[i];
				}
			}
		}
		return null;
	};

	$.fn.oembed.OEmbedProvider = function (name, type, urlschemesarray, apiendpoint, extraSettings) {
		this.name = name;
		this.type = type; // "photo", "video", "link", "rich", null
		this.urlschemes = urlschemesarray;
		this.apiendpoint = apiendpoint;
		this.maxWidth = 500;
		this.maxHeight = 400;
		extraSettings = extraSettings || {};

		if (extraSettings.useYQL) {

			if (extraSettings.useYQL === 'xml') {
				extraSettings.yql = {
					xpath: "//oembed/html",
					from: 'xml',
					apiendpoint: this.apiendpoint,
					url: function (externalurl) {
						return this.apiendpoint + '?format=xml&url=' + externalurl;
					},
					datareturn: function (results) {
						return results.html.replace(/.*\[CDATA\[(.*)\]\]>$/, '$1') || '';
					}
				};
			} else {
				extraSettings.yql = {
					from: 'json',
					apiendpoint: this.apiendpoint,
					url: function (externalurl) {
						return this.apiendpoint + '?format=json&url=' + externalurl;
					},
					datareturn: function (results) {
						if (results.json.type !== 'video' && (results.json.url || results.json.thumbnail_url)) {
							return '<img src="' + (results.json.url || results.json.thumbnail_url) + '" />';
						}
						return results.json.html || '';
					}
				};
			}
			this.apiendpoint = null;
		}

		for (var property in extraSettings) {
			if (Object.prototype.hasOwnProperty.call(extraSettings, property)) {
				this[property] = extraSettings[property];
			}
		}

		this.format = this.format || 'json';
		this.callbackparameter = this.callbackparameter || "callback";
		this.embedtag = this.embedtag || {
			tag: ""
		};

	};

	/*
	 * Function to update existing providers
	 *
	 * @param  {String}    name             The name of the provider
	 * @param  {String}    type             The type of the provider can be "file", "photo", "video", "rich"
	 * @param  {String}    urlshemesarray   Array of url of the provider
	 * @param  {String}    apiendpoint      The endpoint of the provider
	 * @param  {String}    extraSettings    Extra settings of the provider
	 */
	$.fn.updateOEmbedProvider = function (name, type, urlschemesarray, apiendpoint, extraSettings) {
		for (var i = 0; i < $.fn.oembed.providers.length; i++) {
			if ($.fn.oembed.providers[i].name === name) {
				if (type !== null) {
					$.fn.oembed.providers[i].type = type;
				}
				if (urlschemesarray !== null) {
					$.fn.oembed.providers[i].urlschemes = urlschemesarray;
				}
				if (apiendpoint !== null) {
					$.fn.oembed.providers[i].apiendpoint = apiendpoint;
				}
				if (extraSettings !== null) {
					$.fn.oembed.providers[i].extraSettings = extraSettings;
					for (var property in extraSettings) {
						if (property !== null && extraSettings[property] !== null) {
							$.fn.oembed.providers[i][property] = extraSettings[property];
						}
					}
				}
			}
		}
	};

})(this.jQuery);

// Note MD5 String extension removed
//TODO: include md5 and all known providers and short urls in separate file?
