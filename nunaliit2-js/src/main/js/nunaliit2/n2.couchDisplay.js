/*
Copyright (c) 2010, Geomatics and Cartographic Research Centre, Carleton 
University
All rights reserved.

Redistribution and use in source and binary forms, with or without 
modification, are permitted provided that the following conditions are met:

 - Redistributions of source code must retain the above copyright notice, 
   this list of conditions and the following disclaimer.
 - Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.
 - Neither the name of the Geomatics and Cartographic Research Centre, 
   Carleton University nor the names of its contributors may be used to 
   endorse or promote products derived from this software without specific 
   prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE 
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE 
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE 
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR 
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF 
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS 
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN 
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) 
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE 
POSSIBILITY OF SUCH DAMAGE.

$Id: n2.couchDisplay.js 8441 2012-08-15 17:48:33Z jpfiset $
*/
;(function($,$n2){

// Localization
var _loc = function(str,args){ return $n2.loc(str,'nunaliit2-couch',args); };

var DH = 'n2.couchDisplay';

function docCreationTimeSort(lhs, rhs) {
	var timeLhs = 0;
	var timeRhs = 0;
	
	if( lhs && lhs.doc && lhs.doc.nunaliit_created && lhs.doc.nunaliit_created.time ) {
		timeLhs = lhs.doc.nunaliit_created.time;
	}
	if( rhs && rhs.doc && rhs.doc.nunaliit_created && rhs.doc.nunaliit_created.time ) {
		timeRhs = rhs.doc.nunaliit_created.time;
	}
	
	if( timeLhs < timeRhs ) return -1;
	if( timeLhs > timeRhs ) return 1;
	return 0;
};

function startsWith(s, prefix) {
	var left = s.substr(0,prefix.length);
	return (left === prefix);
};

function boolOption(optionName, options, customService){
	var flag = false;
	
	if( options[optionName] ){
		flag = true;
	};
	
	if( customService && !flag ){
		var o = customService.getOption(optionName);
		if( o ){
			flag = true;
		};
	};
	
	return flag;
};

// ===================================================================================

var Display = $n2.Class({
	
	options: null
	
	,documentSource: null
	
	,displayPanelName: null
	
	,currentFeature: null
	
	,createRelatedDocProcess: null
	
	,defaultSchema: null
	
	,postProcessDisplayFns: null
	
	,displayRelatedInfoProcess: null
	
	,displayOnlyRelatedSchemas: null
	
	,displayBriefInRelatedInfo: null
	
	,restrictAddRelatedButtonToLoggedIn: null
	
	,restrictReplyButtonToLoggedIn: null
	
	,classDisplayFunctions: null
	
	,showService: null
	
	,uploadService: null
	
	,customService: null
	
	,authService: null
	
	,requestService: null
	
	,dispatchService: null
	
	,schemaRepository: null
	
	,initialize: function(opts_) {
		var _this = this;
		
		var opts = $n2.extend({
			documentSource: null
			,displayPanelName: null
			,showService: null // asynchronous resolver
			,uploadService: null
			,serviceDirectory: null
			,postProcessDisplayFunction: null
			,displayRelatedInfoFunction: null // legacy
			,displayRelatedInfoProcess: null
			,classDisplayFunctions: {}
		
			// Boolean options
			,displayOnlyRelatedSchemas: false
			,displayBriefInRelatedInfo: false
			,restrictAddRelatedButtonToLoggedIn: false
			,restrictReplyButtonToLoggedIn: false
		}, opts_);
		
		this.documentSource = opts.documentSource;
		this.displayPanelName = opts.displayPanelName;
		this.uploadService = opts.uploadService;
		this.classDisplayFunctions = opts.classDisplayFunctions;
		
		if( opts.serviceDirectory ){
			this.showService = opts.serviceDirectory.showService;
			this.customService = opts.serviceDirectory.customService;
			this.authService = opts.serviceDirectory.authService;			
			this.requestService = opts.serviceDirectory.requestService;
			this.schemaRepository = opts.serviceDirectory.schemaRepository;
			this.dispatchService = opts.serviceDirectory.dispatchService;
		};
		
		if( !this.showService ){
			this.showService = opts.showService;
		};
		
		this.displayOnlyRelatedSchemas = 
			boolOption('displayOnlyRelatedSchemas',opts,this.customService);
		this.displayBriefInRelatedInfo = 
			boolOption('displayBriefInRelatedInfo',opts,this.customService);
		this.restrictAddRelatedButtonToLoggedIn = 
			boolOption('restrictAddRelatedButtonToLoggedIn',opts,this.customService);
		this.restrictReplyButtonToLoggedIn = 
			boolOption('restrictReplyButtonToLoggedIn',opts,this.customService);
			
		// Post-process display functions
		var customService = this.customService;
		this.postProcessDisplayFns = [];
		if( typeof(opts.postProcessDisplayFunction) === 'function' ){
			this.postProcessDisplayFns.push(opts.postProcessDisplayFunction);
		};
		if( customService ){
			var postProcessFns = customService.getOption('displayPostProcessFunctions');
			if( postProcessFns ){
				for(var i=0,e=postProcessFns.length;i<e;++i){
					if( typeof postProcessFns[i] === 'function' ){
						this.postProcessDisplayFns.push(postProcessFns[i]);
					};
				};
			};
		};

		var dispatcher = this.dispatchService;
		if( dispatcher ) {
			var f = function(msg){
				_this._handleDispatch(msg);
			};
			dispatcher.register(DH, 'selected', f);
			dispatcher.register(DH, 'searchResults', f);
			dispatcher.register(DH, 'documentDeleted', f);
			dispatcher.register(DH, 'authLoggedIn', f);
			dispatcher.register(DH, 'authLoggedOut', f);
			dispatcher.register(DH, 'editClosed', f);
			dispatcher.register(DH, 'documentContentCreated', f);
			dispatcher.register(DH, 'documentContentUpdated', f);
		};

		if( this.requestService ){
			this.requestService.addDocumentListener(function(doc){
				_this._refreshDocument(doc);
				_this._populateWaitingDocument(doc);
			});
		};
		
		// Function to display related information
		if( opts.displayRelatedInfoProcess ){
			this.displayRelatedInfoProcess = opts.displayRelatedInfoProcess;
		};
		if( !this.displayRelatedInfoProcess 
		 && opts.displayRelatedInfoFunction ){
			this.displayRelatedInfoProcess 
				= new LegacyDisplayRelatedFunctionAdapter(opts.displayRelatedInfoFunction);
		};
		if( !this.displayRelatedInfoProcess 
		 && customService ){
			var displayRelatedProcess = customService.getOption('displayRelatedInfoProcess');
			if( displayRelatedProcess ){
				this.displayRelatedInfoProcess = displayRelatedProcess;
			};
		};
		if( !this.displayRelatedInfoProcess 
		 && customService ){
			var displayRelatedFn = customService.getOption('displayRelatedInfoFunction');
			if( typeof displayRelatedFn === 'function' ){
				this.displayRelatedInfoProcess 
					= new LegacyDisplayRelatedFunctionAdapter(displayRelatedFn);
			};
		};
		if( !this.displayRelatedInfoProcess ) {
			if( this.displayOnlyRelatedSchemas ) {
				this.displayRelatedInfoProcess 
					= new LegacyDisplayRelatedFunctionAdapter(DisplayRelatedInfo);
			} else {
				this.displayRelatedInfoProcess 
					= new LegacyDisplayRelatedFunctionAdapter(DisplayLinkedInfo);
			};
		};
		
		this.createRelatedDocProcess = new $n2.couchRelatedDoc.CreateRelatedDocProcess({
			documentSource: this.documentSource
			,schemaRepository: this.schemaRepository
			,uploadService: this.uploadService
			,showService: this.showService
			,authService: this.authService
		});
	}

	// external
	,setSchema: function(schema) {
		this.defaultSchema = schema;
	}
	
	// external
	,addPostProcessDisplayFunction: function(fn){
		if( typeof(fn) === 'function' ){
			this.postProcessDisplayFns.push(fn);
		};
	}
	
	,_displayDocument: function($set, doc) {

		var _this = this;
		
		$set.empty();
		
		this._displayObject($set, doc, {
			onUpdated: function() {
				_this._displayDocument($set, doc);
			}
			,onDeleted: function() {
				$set.empty();
			}
		});
	}

	,_shouldSuppressNonApprovedMedia: function(){
		return this.showService.options.eliminateNonApprovedMedia;
	}

	,_shouldSuppressDeniedMedia: function(){
		return this.showService.options.eliminateDeniedMedia;
	}
	
	,_getDisplayDiv: function(){
		var divId = this.displayPanelName;
		return $('#'+divId);
	}
	
	,_displayObject: function($side, data, opt_) {
		var _this = this;
		
		var opt = $n2.extend({
			onUpdated: function(){ 
			}
			,onDeleted: function() {
			}
			,suppressContributionReferences: false
			,showContributionReplyButton: false
			,showAddContributionButton: false
			,showRelatedContributions: false
		},opt_);

		var docId = data._id;
		
		var $elem = $('<div class="couchDisplay_'+$n2.utils.stringToHtmlId(docId)+'"></div>');
		$side.append($elem);

		var $sElem = $('<div class="n2s_handleHover"></div>');
		$elem.append($sElem);
		
		this.showService.displayDocument($sElem, {
			onDisplayed: onDisplayed
		}, data);

		if( data.nunaliit_schema ) {
			var schemaRepository = _this.schemaRepository;
			if( schemaRepository ) {
				schemaRepository.getSchema({
					name: data.nunaliit_schema
					,onSuccess: function(schema) {
						continueDisplay(schema);
					}
					,onError: function(){
						continueDisplay(null);
					}
				});
				
			} else {
				continueDisplay(null);
			};
			
		} else {
			continueDisplay(null);
		};
		
		function continueDisplay(schema){
			_this._addAttachmentProgress($elem, data);
			
			_this._addButtons($elem, data, {
				schema: schema
				,related: true
				,reply: true
				,geom: true
				,edit: true
				,'delete': true
				,addLayer: true
				,treeView: true
			});
			
			var $div = $('<div>')
				.addClass('n2Display_relatedInfo couchDisplayRelated_'+$n2.utils.stringToHtmlId(data._id))
				.appendTo($elem);
			var relatedInfoId = $n2.utils.getElementIdentifier($div);
			_this.displayRelatedInfoProcess.display({
				divId: relatedInfoId
				,display: _this
				,doc: data
				,schema: schema
			});
		};
		
		function onDisplayed($sElem, data, schema, opt_){
			if( _this.classDisplayFunctions ) {
				for(var className in _this.classDisplayFunctions){
					var fn = _this.classDisplayFunctions[className];
					var jqCallback = eachFunctionForClass(className, fn, data, opt);
					$sElem.find('.'+className).each(jqCallback);
				};
			};
			
			// Perform post-process function 
			for(var i=0,e=_this.postProcessDisplayFns.length; i<e; ++i){
				var fn = _this.postProcessDisplayFns[i];
				fn(data, $sElem);
			};
		};

		function eachFunctionForClass(className, fn, data, opt){
			return function(){
				var $jq = $(this);
				fn(data, $jq, opt);
				$jq.removeClass(className);
			};
		};
	}
	
	,_addButtons: function($elem, data, opt_) {
		var _this = this;
		
		var opt = $n2.extend({
			schema: null
			,focus: false
			,related: false
			,reply: false
			,geom: false
			,edit: false
			,'delete': false
			,addLayer: false
			,treeView: false
		},opt_);

		var $buttons = $('<div></div>');
		$buttons.addClass('n2Display_buttons');
		$buttons.addClass('n2Display_buttons_'+$n2.utils.stringToHtmlId(data._id));
		$elem.append( $buttons );
		
		var optionClass = 'options';
		if( opt.focus ) optionClass += '_focus';
		if( opt.edit ) optionClass += '_edit';
		if( opt.related ) optionClass += '_related';
		if( opt.reply ) optionClass += '_reply';
		if( opt.geom ) optionClass += '_geom';
		if( opt['delete'] ) optionClass += '_delete';
		if( opt.addLayer ) optionClass += '_addLayer';
		if( opt.treeView ) optionClass += '_treeView';
		$buttons.addClass(optionClass);

		var opts = {
			doc: data
			,schema: opt.schema
			,focus: opt.focus
			,edit: opt.edit
			,related: opt.related
			,reply: opt.reply
			,geom: opt.geom
			,addLayer: opt.addLayer
			,treeView: opt.treeView
		};
		opts['delete'] = opt['delete'];
		this._displayButtons($buttons, opts);
	}
	
	,_refreshButtons: function($elem){
		var _this = this;
		
		var docId = null;
		var fFocus = false;
		var fEdit = false;
		var fRelated = false;
		var fReply = false;
		var fGeom = false;
		var fDelete = false;
		var fAddLayer = false;
		var fTreeView = false;
		var classAttr = $elem.attr('class');
		var classes = classAttr.split(' ');
		for(var i=0,e=classes.length; i<e; ++i){
			var className = classes[i];
			if( startsWith(className,'n2Display_buttons_') ){
				var escapedDocId = className.substr('n2Display_buttons_'.length);
				docId = $n2.utils.unescapeHtmlId(escapedDocId);
				
			} else if( startsWith(className,'options') ){
				var options = className.split('_');
				for(var j=0,k=options.length; j<k; ++j){
					var o = options[j];
					if( 'focus' === o ){ fFocus = true; }
					else if( 'edit' === o ){ fEdit = true; }
					else if( 'related' === o ){ fRelated = true; }
					else if( 'reply' === o ){ fReply = true; }
					else if( 'geom' === o ){ fGeom = true; }
					else if( 'addLayer' === o ){ fAddLayer = true; }
					else if( 'treeView' === o ){ fTreeView = true; }
					else if( 'delete' === o ){ fDelete = true; };
				};
			};
		};
		
		if( docId ){
			this.documentSource.getDocument({
				docId: docId
				,onSuccess: getSchema
				,onError:function(){}
			});
		};
		
		function getSchema(doc){
			if( doc.nunaliit_schema ) {
				var schemaRepository = _this.schemaRepository;
				if( schemaRepository ) {
					schemaRepository.getSchema({
						name: doc.nunaliit_schema
						,onSuccess: function(schema) {
							drawButtons(doc,schema);
						}
						,onError: function(){
							drawButtons(doc,null);
						}
					});
					
				} else {
					drawButtons(doc,null);
				};
				
			} else {
				drawButtons(doc,null);
			};
		};
		
		function drawButtons(doc,schema){
			var opts = {
				doc: doc
				,schema: schema
				,focus: fFocus
				,edit: fEdit
				,related: fRelated
				,reply: fReply
				,geom: fGeom
				,addLayer: fAddLayer
				,treeView: fTreeView
			};
			opts['delete'] = fDelete;
			$elem.empty();
			_this._displayButtons($elem, opts);
		};
	}
	
	,_displayButtons: function($buttons, opt){

		var _this = this;
		var data = opt.doc;
		var schema = opt.schema;
		
		var dispatcher = this.dispatchService;
		var schemaRepository = _this.schemaRepository;

 		// Show 'focus' button
 		if( opt.focus 
 		 && data
 		 && data._id ) {
			var $focusButton = $('<a href="#"></a>');
			var focusText = _loc('More Info');
			$focusButton.text( focusText );
			$buttons.append($focusButton);
			$focusButton.click(function(){
				_this._dispatch({
					type:'userSelect'
					,docId: data._id
				})
				return false;
			});
			addClasses($focusButton, focusText);
 		};

 		// Show 'edit' button
 		if( opt.edit 
 		 && $n2.couchMap.canEditDoc(data) ) {
			var $editButton = $('<a href="#"></a>');
			var editText = _loc('Edit');
			$editButton.text( editText );
			$buttons.append($editButton);
			$editButton.click(function(){
				_this._performDocumentEdit(data, opt);
				return false;
			});
			addClasses($editButton, editText);
 		};

 		// Show 'delete' button
 		if( opt['delete'] 
 		 && $n2.couchMap.canDeleteDoc(data) ) {
			var $deleteButton = $('<a href="#"></a>');
			var deleteText = _loc('Delete');
			$deleteButton.text( deleteText );
			$buttons.append($deleteButton);
			$deleteButton.click(function(){
				_this._performDocumentDelete(data, opt);
				return false;
			});
			addClasses($deleteButton, deleteText);
 		};
		
 		// Show 'add related' button
		if( opt.related
		 && this.displayRelatedInfoProcess ) {
 			this.displayRelatedInfoProcess.addButton({
 				display: this
 				,div: $buttons[0]
 				,doc: data
 				,schema: opt.schema
 			});
 		};
		
 		// Show 'reply' button
		if( opt.reply
		 && opt.schema
		 && opt.schema.options 
		 && opt.schema.options.enableReplies
		 ) {
			var showReplyButton = true;
			if( this.restrictReplyButtonToLoggedIn ){
				var sessionContext = $n2.couch.getSession().getContext();
				if( !sessionContext || !sessionContext.name ) {
					showReplyButton = false;
				};
			};
			
			if( showReplyButton ) {
				var $replyButton = $('<a href="#"></a>');
				var replyText = _loc('Reply');
				$replyButton.text( replyText );
				$buttons.append($replyButton);
				$replyButton.click(function(){
					_this._replyToDocument(data, opt.schema);
					return false;
				});
				addClasses($replyButton, 'reply');
			};
		};
		
 		// Show 'find on map' button
		if( dispatcher 
		 && opt.geom
		 && data 
		 && data.nunaliit_geom 
		 && dispatcher.isEventTypeRegistered('findOnMap')
		 ) {
			// Check iff document can be displayed on a map
			var showFindOnMapButton = false;
			if( data.nunaliit_layers && data.nunaliit_layers.length > 0 ) {
				var m = {
					type:'mapGetLayers'
					,layers:{}
				};
				dispatcher.synchronousCall(DH,m);
				for(var i=0,e=data.nunaliit_layers.length; i<e; ++i){
					var layerId = data.nunaliit_layers[i];
					if( m.layers[layerId] ){
						showFindOnMapButton = true;
					};
				};
			};

			if( showFindOnMapButton ) {
				var $findGeomButton = $('<a href="#"></a>');
				var findGeomText = _loc('Find on Map');
				$findGeomButton.text( findGeomText );
				$buttons.append($findGeomButton);
	
				var x = (data.nunaliit_geom.bbox[0] + data.nunaliit_geom.bbox[2]) / 2;
				var y = (data.nunaliit_geom.bbox[1] + data.nunaliit_geom.bbox[3]) / 2;
				
				$findGeomButton.click(function(){
					// Check if we need to turn a layer on
					var visible = false;
					var layerIdToTurnOn = null;
					var m = {
							type:'mapGetLayers'
							,layers:{}
						};
					dispatcher.synchronousCall(DH,m);
					for(var i=0,e=data.nunaliit_layers.length; i<e; ++i){
						var layerId = data.nunaliit_layers[i];
						if( m.layers[layerId] ){
							if( m.layers[layerId].visible ){
								visible = true;
							} else {
								layerIdToTurnOn = layerId;
							};
						};
					};

					// Turn on layer
					if( !visible ){
						_this._dispatch({
							type: 'setMapLayerVisibility'
							,layerId: layerIdToTurnOn
							,visible: true
						});
					};
					
					// Move map and display feature 
					_this._dispatch({
						type: 'findOnMap'
						,fid: data._id
						,srsName: 'EPSG:4326'
						,x: x
						,y: y
					});
					
					return false;
				});
				addClasses($findGeomButton, findGeomText);
			};
		};

		// Show 'Add Layer' button
		if( opt.addLayer
		 && data
		 && data.nunaliit_layer_definition
		 && dispatcher
		 && dispatcher.isEventTypeRegistered('addLayerToMap')
		 ) {
			var $addLayerButton = $('<a href="#"></a>');
			var btnText = _loc('Add Layer');
			$addLayerButton.text( btnText );
			$buttons.append($addLayerButton);

			var layerDefinition = data.nunaliit_layer_definition;
			var layerId = layerDefinition.id;
			if( !layerId ){
				layerId = data._id;
			};
			var layerDef = {
				name: layerDefinition.name
				,type: 'couchdb'
				,options: {
					layerName: layerId
					,documentSource: this.documentSource
				}
			};
			
			$addLayerButton.click(function(){
				_this._dispatch({
					type: 'addLayerToMap'
					,layer: layerDef
					,options: {
						setExtent: {
							bounds: layerDefinition.bbox
							,crs: 'EPSG:4326'
						}
					}
				});
				return false;
			});
			addClasses($addLayerButton, btnText);
		};

		// Show 'Tree View' button
		if( opt.treeView
		 && data
		 ) {
			var $treeViewButton = $('<a>')
				.attr('href','#')
				.text( _loc('Tree View') )
				.appendTo($buttons)
				.click(function(){
					_this._performDocumentTreeView(data);
					return false;
				});

			addClasses($treeViewButton, 'tree_view');
		};

		/**
		 * Generate and insert css classes for the generated element, based on the given tag.
		 * @param elem the jQuery element to be modified
		 * @param tag the string tag to be used in generating classes for elem
		 */
		function addClasses(elem, tag) {
			elem.addClass('nunaliit_form_link');
			
			var compactTag = tag;
			var spaceIndex = compactTag.indexOf(' ');
			while (-1 !== spaceIndex) {
				compactTag = compactTag.slice(0,spaceIndex) + '_' +
					compactTag.slice(spaceIndex + 1);
				spaceIndex = compactTag.indexOf(' ');
			};
			elem.addClass('nunaliit_form_link_' + compactTag.toLowerCase());
		};
		
	}
	
	,_addAttachmentProgress: function($elem, data){
		var $progress = $('<div></div>')
			.addClass('n2Display_attProgress')
			.addClass('n2Display_attProgress_'+$n2.utils.stringToHtmlId(data._id) )
			.appendTo( $elem );
		
		this._refreshAttachmentProgress($progress, data);
	}
	
	,_refreshAttachmentProgress: function($progress, data){

		var status = null;
		
		$progress.empty();
		
		// Find an attachment which is in progress
		if( data.nunaliit_attachments 
		 && data.nunaliit_attachments.files ){
			for(var attName in data.nunaliit_attachments.files){
				var att = data.nunaliit_attachments.files[attName];
				
				// Skip non-original attachments
				if( !att.source ){
					if( att.status 
					 && 'attached' !== att.status ){
						// OK, progress must be reported. Accumulate
						// various status since there could be more than
						// one attachment.
						if( !status ){
							status = {};
						};
						status[att.status] = true;
					};
				};
			};
		};

		// Report status
		if( status ){
			var $outer = $('<div></div>')
				.addClass('n2Display_attProgress_outer')
				.appendTo($progress);

			$('<div></div>')
				.addClass('n2Display_attProgress_icon')
				.appendTo($outer);
		
			if( status['waiting for approval'] ){
				$outer.addClass('n2Display_attProgress_waiting');
				
				$('<div></div>')
					.addClass('n2Display_attProgress_message')
					.text( _loc('Attachment is waiting for approval') )
					.appendTo($outer);
				
			} else if( status['denied'] ){
				$outer.addClass('n2Display_attProgress_denied');
				
				$('<div></div>')
					.addClass('n2Display_attProgress_message')
					.text( _loc('Attachment has been denied') )
					.appendTo($outer);
				
			} else {
				// Robot is working
				$outer.addClass('n2Display_attProgress_busy');
				
				$('<div></div>')
					.addClass('n2Display_attProgress_message')
					.text( _loc('Attachment is being processed') )
					.appendTo($outer);
			};

			$('<div></div>')
				.addClass('n2Display_attProgress_outer_end')
				.appendTo($outer);
		};
	}
	
	,_addRelatedDocument: function(docId, relatedSchemaNames){
		var _this = this;
		
		this.createRelatedDocProcess.addRelatedDocumentFromSchemaNames({
			docId: docId
			,relatedSchemaNames: relatedSchemaNames
			,onSuccess: function(docId){
//				_this._RefreshClickedFeature();
			}
		});
	}
	
	,_getAllReferences: function(opts_){
		var opts = $n2.extend({
			doc: null
			,onSuccess: function(refInfo){}
			,onError: function(err){}
		},opts_);
		
		var _this = this;
		
		var doc = opts.doc;
		
		// Keep track of docIds and associated schemas
		var refInfo = {};
		
		// Compute forward references
		var references = [];
		$n2.couchUtils.extractLinks(doc, references);
		for(var i=0, e=references.length; i<e; ++i){
			var linkDocId = references[i].doc;
			if( !refInfo[linkDocId] ){
				refInfo[linkDocId] = {};
			};
			refInfo[linkDocId].forward = true;
		};
		
		// Get identifiers of all documents that reference this one
		this.documentSource.getReferencesFromId({
			docId: doc._id
			,onSuccess: function(refIds){
				for(var i=0,e=refIds.length;i<e;++i){
					var id = refIds[i];
					if( !refInfo[id] ){
						refInfo[id] = {};
					};
					refInfo[id].reverse = true;
				};
				
				getRefSchemas();
			}
			,onError: getRefSchemas
		});

		function getRefSchemas(){
			var requestDocIds = [];
			for(var requestDocId in refInfo){
				requestDocIds.push(requestDocId);
			};

			_this.documentSource.getDocumentInfoFromIds({
				docIds: requestDocIds
				,onSuccess: function(infos){
					for(var i=0,e=infos.length;i<e;++i){
						var requestDocId = infos[i].id;
						
						refInfo[requestDocId].exists = true;
						if( infos[i].schema ) {
							refInfo[requestDocId].schema = infos[i].schema;
						};
					};
					
					opts.onSuccess(refInfo);
				}
				,onError: opts.onError
			});
		};
	}

	,_replyToDocument: function(doc, schema){
		var _this = this;
		
		this.createRelatedDocProcess.replyToDocument({
			doc: doc
			,schema: schema
			,onSuccess: function(docId){
			}
		});
	}
	
	,_refreshDocument: function(doc){

		var _this = this;
		
		// Retrieve schema document
		var schemaRepository = this.schemaRepository;
		if( doc.nunaliit_schema && schemaRepository ) {
			schemaRepository.getSchema({
				name: doc.nunaliit_schema
				,onSuccess: function(schema) {
					refreshDocWithSchema(doc, schema);
				}
				,onError: function(){
					refreshDocWithSchema(doc, null);
				}
			});
		} else {
			refreshDocWithSchema(doc, null);
		};
	
		function refreshDocWithSchema(doc, schema){
			var docId = doc._id;
			
			$('.displayRelatedButton_'+$n2.utils.stringToHtmlId(docId)).each(function(){
				var $buttonDiv = $(this);
				$buttonDiv.empty();
				_this._addButtons($buttonDiv, doc, {
					schema: schema
					,focus: true
					,geom: true
					,reply: true
					,treeView: true
				});
			});
			
			$('.n2Display_attProgress_'+$n2.utils.stringToHtmlId(docId)).each(function(){
				var $progress = $(this);
				_this._refreshAttachmentProgress($progress,doc);
			});
			
			if( _this._shouldSuppressNonApprovedMedia() ){
				if( $n2.couchMap.documentContainsMedia(doc) 
				 && false == $n2.couchMap.documentContainsApprovedMedia(doc) ) {
					$('.n2SupressNonApprovedMedia_'+$n2.utils.stringToHtmlId(docId)).each(function(){
						var $div = $(this);
						var $parent = $div.parent();
						$div.remove();
						_this._fixDocumentList($parent);
					});
				};
			} else if( _this._shouldSuppressDeniedMedia() ){
				if( $n2.couchMap.documentContainsMedia(doc) 
				 && $n2.couchMap.documentContainsDeniedMedia(doc) ) {
					$('.n2SupressDeniedMedia_'+$n2.utils.stringToHtmlId(docId)).each(function(){
						var $div = $(this);
						var $parent = $div.parent();
						$div.remove();
						_this._fixDocumentList($parent);
					});
				};
			};
		};
	}
	
	,_populateWaitingDocument: function(doc){
		var _this = this;
		
		if( doc ) {
			var docId = doc._id;
			var escaped = $n2.utils.stringToHtmlId(docId);
			var cName = 'couchDisplayWait_'+escaped;
			$('.'+cName).each(function(){
				var $set = $(this);
				$set
					.removeClass(cName)
					.addClass('couchDisplayAdded_'+escaped);
				_this._displayDocument($set, doc);
			});
		};
	}
	
	,_fixDocumentList: function($elem){
		if( $elem.hasClass('_n2DocumentListParent') ) {
			var $relatedDiv = $elem;
		} else {
			$relatedDiv = $elem.parents('._n2DocumentListParent');
		};
		if( $relatedDiv.length > 0 ){
			var $docDiv = $relatedDiv.find('._n2DocumentListEntry');
			var count = $docDiv.length;
			$relatedDiv.find('._n2DisplayDocCount').text(''+count);
			
			$docDiv.each(function(i){
				var $doc = $(this);
				$doc.removeClass('olkitSearchMod2_0');
				$doc.removeClass('olkitSearchMod2_1');
				$doc.addClass('olkitSearchMod2_'+(i%2));
			});
		};
	}
	
	,_performDocumentEdit: function(data, options_) {
		var _this = this;
		
		this.documentSource.getDocument({
			docId: data._id
			,onSuccess: function(doc){
				_this._dispatch({
					type: 'editInitiate'
					,docId: doc._id
					,doc: doc
				});
			}
			,onError: function(errorMsg){
				$n2.log('Unable to load document: '+errorMsg);
			}
		});
	}
	
	,_performDocumentDelete: function(data, options_) {
		var _this = this;

		if( confirm( _loc('You are about to delete this document. Do you want to proceed?') ) ) {
			this.documentSource.deleteDocument({
				doc: data
				,onSuccess: function() {
					if( options_.onDeleted ) {
						options_.onDeleted();
					};
				}
			});
		};
	}
	
	,_performDocumentTreeView: function(data) {
		new TreeDocumentViewer({
			doc: data
		});
	}
	
	,_displayDocumentId: function($set, docId) {

		var _this = this;
		
		$set.empty();

		this.documentSource.getDocument({
			docId: docId
			,onSuccess: function(doc) {
				_this._displayDocument($set, doc);
			}
			,onError: function(err) {
				$set.empty();
				$('<div>')
					.addClass('couchDisplayWait_'+$n2.utils.stringToHtmlId(docId))
					.text( _loc('Unable to retrieve document') )
					.appendTo($set);
			}
		});
	}
	
	,_handleDispatch: function(msg){
		var _this = this;
		
		var $div = this._getDisplayDiv();
		if( $div.length < 1 ){
			// No longer displaying. Un-register this event.
			dispatcher.deregister(addr);
			return;
		};
		
		// Selected document
		if( msg.type === 'selected' ) {
			if( msg.doc ) {
				this._displayDocument($div, msg.doc);
				
			} else if( msg.docId ) {
				this._displayDocumentId($div, msg.docId);
				
			} else if( msg.docs ) {
				this._displayMultipleDocuments($div, msg.docs);
				
			} else if( msg.docIds ) {
				$div.empty();
				this._displayMultipleDocumentIds($div, msg.docIds)
			};
			
		} else if( msg.type === 'searchResults' ) {
			this._displaySearchResults(msg.results);
			
		} else if( msg.type === 'documentDeleted' ) {
			var docId = msg.docId;
			this._handleDocumentDeletion(docId);
			
		} else if( msg.type === 'authLoggedIn' 
			|| msg.type === 'authLoggedOut' ) {
			$('.n2Display_buttons').each(function(){
				var $elem = $(this);
				_this._refreshButtons($elem);
			});
			
		} else if( msg.type === 'editClosed' ) {
			var deleted = msg.deleted;
			if( !deleted ) {
				var doc = msg.doc;
				if( doc ) {
					this._displayDocument($div, doc);
				};
			};
			
		} else if( msg.type === 'documentContentCreated' ) {
			this._handleDocumentCreation(msg.doc);
			this._populateWaitingDocument(msg.doc);
			
		} else if( msg.type === 'documentContentUpdated' ) {
			this._refreshDocument(msg.doc);
			this._populateWaitingDocument(msg.doc);
		};
	}
	
	,_displayMultipleDocuments: function($container, docs) {

		var _this = this;
		
		var $list = $('<div class="_n2DocumentListParent"></div>');
		$container.append($list);
		
		for(var i=0,e=docs.length; i<e; ++i) {
			var doc = docs[i];
			
			var $div = $('<div></div>')
				.addClass('_n2DocumentListEntry')
				.addClass('_n2DocumentListEntry_'+$n2.utils.stringToHtmlId(docId))
				.addClass('olkitSearchMod2_'+(i%2))
				.addClass('n2SupressNonApprovedMedia_'+$n2.utils.stringToHtmlId(docId))
				.addClass('n2SupressDeniedMedia_'+$n2.utils.stringToHtmlId(docId))
				;
			$list.append($div);

			var $contentDiv = $('<div class="n2s_handleHover"></div>');
			$div.append($contentDiv);
			this.showService.displayBriefDescription($contentDiv, {}, doc);

			var $buttonDiv = $('<div></div>');
			$div.append($buttonDiv);
			this._addButtons($buttonDiv, doc, {focus:true,geom:true});
		};
	}

	,_displayMultipleDocumentIds: function($container, docIds) {

		var _this = this;
		
		var $list = $('<div class="_n2DocumentListParent"></div>');
		$container.append($list);
		
		for(var i=0,e=docIds.length; i<e; ++i){
			var docId = docIds[i];
			
			var $div = $('<div></div>')
				.addClass('_n2DocumentListEntry')
				.addClass('_n2DocumentListEntry_'+$n2.utils.stringToHtmlId(docId))
				.addClass('olkitSearchMod2_'+(i%2))
				.addClass('n2SupressNonApprovedMedia_'+$n2.utils.stringToHtmlId(docId))
				.addClass('n2SupressDeniedMedia_'+$n2.utils.stringToHtmlId(docId))
				;
			$list.append($div);

			var $contentDiv = $('<div class="n2s_handleHover"></div>');
			$div.append($contentDiv);
			this.showService.printBriefDescription($contentDiv, docId);
			
			if( this.requestService ) {
				var $progressDiv = $('<div class="n2Display_attProgress n2Display_attProgress_'+$n2.utils.stringToHtmlId(docId)+'"></div>');
				$div.append($progressDiv);

				var $buttonDiv = $('<div class="displayRelatedButton displayRelatedButton_'+$n2.utils.stringToHtmlId(docId)+'"></div>');
				$div.append($buttonDiv);
				
				this.requestService.requestDocument(docId);
			};
		};
	}
	
	,_displaySearchResults: function(results){
		var ids = [];
		if( results && results.sorted && results.sorted.length ) {
			for(var i=0,e=results.sorted.length; i<e; ++i){
				ids.push(results.sorted[i].id);
			};
		};
		var $div = this._getDisplayDiv();
		$div.empty();
		if( ids.length < 1 ) {
			$div.append( $('<div>'+_loc('Search results empty')+'</div>') );
		} else {
			var $results = $('<div class="n2_search_result"></div>')
				.appendTo($div);
			this._displayMultipleDocumentIds($results, ids);
		};
	}
	
	,_dispatch: function(m){
		var dispatcher = this.dispatchService;
		if( dispatcher ) {
			dispatcher.send(DH,m);
		};
	}
	
	,_handleDocumentDeletion: function(docId){
		var _this = this;
		
		// Main document displayed
		var $elems = $('.couchDisplay_'+$n2.utils.stringToHtmlId(docId));
		$elems.remove();
		
		// Document waiting to be displayed
		var $elems = $('.couchDisplayWait_'+$n2.utils.stringToHtmlId(docId));
		$elems.remove();
		
		// Documents in list
		var $entries = $('._n2DocumentListEntry_'+$n2.utils.stringToHtmlId(docId));
		$entries.each(function(){
			var $entry = $(this);
			var $p = $entry.parent();
			$entry.remove();
			_this._fixDocumentList($p);
		});
		
	}
	
	,_handleDocumentCreation: function(doc){
		var _this = this;
		
		// Find all documents referenced by this one
		var links = $n2.couchGeom.extractLinks(doc);
		for(var i=0,e=links.length;i<e;++i){
			var refDocId = links[i].doc;
			if( refDocId ){
				// Check if we have a related document section displayed for
				// this referenced document
				var $elems = $('.couchDisplayRelated_'+$n2.utils.stringToHtmlId(refDocId));
				if( $elems.length > 0 ){
					// We must redisplay this related info section
					refreshRelatedInfo(refDocId, $elems);
				};
			};
		};

		function refreshRelatedInfo(docId, $elems) {
			// Get document
			var request = _this.requestService;
			if( request ){
				request.requestDocument(docId,function(d){
					loadedData(d, $elems);
				});
			};
		};
		
		function loadedData(data, $elems) {
			// Get schema
			var schemaName = data.nunaliit_schema ? data.nunaliit_schema : null;
			var schemaRepository = _this.schemaRepository;
			if( schemaName && schemaRepository ) {
				schemaRepository.getSchema({
					name: schemaName
					,onSuccess: function(schema) {
						loadedSchema(data, schema, $elems);
					}
					,onError: function(){
						loadedSchema(data, null, $elems);
					}
				});
			} else {
				loadedSchema(data, null, $elems);
			};
		};
		
		function loadedSchema(data, schema, $elems){
			$elems.each(function(){
				var $e = $(this);
				// Refresh
				$e.empty();
				_this.displayRelatedInfoProcess.display({
					div: $e
					,display: _this
					,doc: data
					,schema: schema
				});
			});
		};
	}
});

//===================================================================================

var LegacyDisplayRelatedFunctionAdapter = $n2.Class({
	legacyFunction: null,
	
	initialize: function(legacyFunction){
		this.legacyFunction = legacyFunction;
	},
	
	display: function(opts_){
		return this.legacyFunction(opts_);
	},
	
	addButton: function(opts_){
		var opts = $n2.extend({
			display: null
			,div: null
			,doc: null
			,schema: null
		},opts_);
		
		var display = opts.display;
		var data = opts.doc;
		var schema = opts.schema;
		var $buttons = $(opts.div);
		
		var schemaRepository = display.schemaRepository;
		
 		// Show 'add related' button
		if( schema
		 && schema.relatedSchemaNames 
		 && schema.relatedSchemaNames.length
		 ) {
			var showRelatedButton = true;
			if( display.restrictAddRelatedButtonToLoggedIn ){
				var sessionContext = $n2.couch.getSession().getContext();
				if( !sessionContext || !sessionContext.name ) {
					showRelatedButton = false;
				};
			};
			
			if( showRelatedButton ) {
	 			var selectId = $n2.getUniqueId();
				var $addRelatedButton = $('<select>')
					.attr('id',selectId)
					.appendTo($buttons);
				$('<option>')
					.text( _loc('Add Related Item') )
					.val('')
					.appendTo($addRelatedButton);
				for(var i=0,e=schema.relatedSchemaNames.length; i<e; ++i){
					var schemaName = schema.relatedSchemaNames[i];
					$('<option>')
						.text(schemaName)
						.val(schemaName)
						.appendTo($addRelatedButton);
					
					if( schemaRepository ){
						schemaRepository.getSchema({
							name: schemaName
							,onSuccess: function(schema){
								$('#'+selectId).find('option').each(function(){
									var $option = $(this);
									if( $option.val() === schema.name
									 && schema.label ){
										$option.text(schema.label);
									};
								});
							}
						});
					};
				};
				
				$addRelatedButton.change(function(){
					var val = $(this).val();
					$(this).val('');
					display._addRelatedDocument(data._id, [val]);
					return false;
				});
				
				$addRelatedButton.addClass('nunaliit_form_link');
				$addRelatedButton.addClass('nunaliit_form_link_add_related_item');
				
				$addRelatedButton.menuselector();
			};
		};
	}
});

//===================================================================================

function _displayRelatedDocuments(display_, contId, relatedSchemaName, relatedDocIds){
	var $container = $('#'+contId);
	
	if( !relatedDocIds || relatedDocIds.length < 1 ) {
		$container.remove();
		return;
	};
	
	//legacyDisplay();
	blindDisplay();
	
	function blindDisplay(){

		var blindId = $n2.getUniqueId();
		var $blindWidget = $('<div id="'+blindId+'" class="_n2DocumentListParent"><h3></h3><div style="padding-left:0px;padding-right:0px;"></div></div>');
		$container.append($blindWidget);
		var bw = $n2.blindWidget($blindWidget,{
			data: relatedDocIds
			,onBeforeOpen: beforeOpen
		});
		bw.setHtml('<span class="_n2DisplaySchemaName"></span> (<span class="_n2DisplayDocCount"></span>)');
		if( null == relatedSchemaName ) {
			$blindWidget.find('._n2DisplaySchemaName').text( _loc('Uncategorized') );
		} else {
			$blindWidget.find('._n2DisplaySchemaName').text(relatedSchemaName);
		};
		$blindWidget.find('._n2DisplayDocCount').text(''+relatedDocIds.length);
		
		var schemaRepository = display_.schemaRepository;
		if( schemaRepository && relatedSchemaName ){
			schemaRepository.getSchema({
				name: relatedSchemaName
				,onSuccess: function(schema){
					var $blindWidget = $('#'+blindId);
					$blindWidget.find('._n2DisplaySchemaName').text( _loc(schema.getLabel()) );
				}
			});
		};

		function beforeOpen(info){
			var $div = info.content;
			
			var $dataloaded = $div.find('.___n2DataLoaded');
			if( $dataloaded.length > 0 ) {
				// nothing to do
				return;
			};
			
			// Fetch data
			var docIds = info.data;
			$div.empty();
			$div.append( $('<div class="___n2DataLoaded" style="display:none;"></div>') );
			for(var i=0,e=docIds.length; i<e; ++i){
				var docId = docIds[i];
				
				var $docWrapper = $('<div></div>');
				$div.append($docWrapper);
				if ( 0 === i ) { // mark first and last one
					$docWrapper.addClass('_n2DocumentListStart');
				};
				if ( (e-1) === i ) {
					$docWrapper.addClass('_n2DocumentListEnd');
				};
				$docWrapper
					.addClass('_n2DocumentListEntry')
					.addClass('_n2DocumentListEntry_'+$n2.utils.stringToHtmlId(docId))
					.addClass('olkitSearchMod2_'+(i%2))
					.addClass('n2SupressNonApprovedMedia_'+$n2.utils.stringToHtmlId(docId))
					.addClass('n2SupressDeniedMedia_'+$n2.utils.stringToHtmlId(docId))
					;
				
				var $doc = $('<div></div>');
				$docWrapper.append($doc);

				if( display_.showService ) {
					if( display_.displayBriefInRelatedInfo ){
						display_.showService.printBriefDescription($doc,docId);
					} else {
						display_.showService.printDocument($doc,docId);
					};
				} else {
					$doc.text(docId);
				};
				if( display_.requestService ) {
					var $progressDiv = $('<div class="n2Display_attProgress n2Display_attProgress_'+$n2.utils.stringToHtmlId(docId)+'"></div>');
					$docWrapper.append($progressDiv);

					var $buttonDiv = $('<div class="displayRelatedButton displayRelatedButton_'+$n2.utils.stringToHtmlId(docId)+'"></div>');
					$docWrapper.append($buttonDiv);
					
					display_.requestService.requestDocument(docId);
				};
			};
		};
	};
};

function DisplayRelatedInfo(opts_){
	var opts = $n2.extend({
		divId: null
		,div: null
		,display: null
		,doc: null
		,schema: null
	},opts_);
	
	var doc = opts.doc;
	var docId = doc._id;
	var display = opts.display;
	var schema = opts.schema;
	
	var $elem = opts.div;
	if( ! $elem ) {
		$elem = $('#'+opts.divId);
	};
	if( ! $elem.length) {
		return;
	};
	
	if( !schema 
	 || !schema.relatedSchemaNames
	 || !schema.relatedSchemaNames.length ){
		return;
	};
	
	// Make a map of related schemas
	var schemaInfoByName = {};
	for(var i=0,e=schema.relatedSchemaNames.length; i<e; ++i){
		var relatedSchemaName = schema.relatedSchemaNames[i];
		schemaInfoByName[relatedSchemaName] = { docIds:[] };
	};

	// Get references
	display._getAllReferences({
		doc: doc
		,onSuccess: showSections
	});

	function showSections(refInfo){
		// Accumulate document ids under the associated schema
		for(var requestDocId in refInfo){
			if( refInfo[requestDocId].exists 
			 && refInfo[requestDocId].reverse
			 && refInfo[requestDocId].schema ) {
				var schemaName = refInfo[requestDocId].schema;
				var schemaInfo = schemaInfoByName[schemaName];
				if( schemaInfo ){
					schemaInfo.docIds.push(requestDocId);
				};
			};
		};

		// Add section with related documents
		for(var schemaName in schemaInfoByName){
			var schemaInfo = schemaInfoByName[schemaName];
			if( schemaInfo.docIds.length > 0 ) {
				var contId = $n2.getUniqueId();
				var $div = $('<div id="'+contId+'"></div>');
				$elem.append($div);

				var relatedDocIds = schemaInfo.docIds;
				
				_displayRelatedDocuments(display, contId, schemaName, relatedDocIds);
			};
		};
	};
};

//===================================================================================

function DisplayLinkedInfo(opts_){
	var opts = $n2.extend({
		divId: null
		,div: null
		,display: null
		,doc: null
		,schema: null
	},opts_);
	
	var display = opts.display;
	var doc = opts.doc;
	var docId = doc._id;
	
	var $elem = opts.div;
	if( ! $elem ) {
		$elem = $('#'+opts.divId);
	};
	if( ! $elem.length) {
		return;
	};

	// Get references
	display._getAllReferences({
		doc: doc
		,onSuccess: showSections
	});

	function showSections(refInfo){
		// Accumulate document ids under the associated schema
		var relatedDocsFromSchemas = {};
		var uncategorizedDocIds = [];
		for(var requestDocId in refInfo){
			if( refInfo[requestDocId].exists ) {
				var schemaName = refInfo[requestDocId].schema;
				
				if( schemaName ) {
					if( !relatedDocsFromSchemas[schemaName] ) {
						relatedDocsFromSchemas[schemaName] = {
							docIds: []
						};
					};
					relatedDocsFromSchemas[schemaName].docIds.push(requestDocId);
				} else {
					uncategorizedDocIds.push(requestDocId);
				};
			};
		};

		// Add section with related documents
		for(var schemaName in relatedDocsFromSchemas){
			var contId = $n2.getUniqueId();
			var $div = $('<div id="'+contId+'"></div>');
			$elem.append($div);

			var relatedDocIds = relatedDocsFromSchemas[schemaName].docIds;
			
			_displayRelatedDocuments(display, contId, schemaName, relatedDocIds);
		};
		
		// Add uncategorized
		if( uncategorizedDocIds.length > 0 ) {
			var contId = $n2.getUniqueId();
			var $div = $('<div id="'+contId+'"></div>');
			$elem.append($div);

			_displayRelatedDocuments(display, contId, null, uncategorizedDocIds);
		};
	};
};

//===================================================================================

var CommentRelatedInfo = $n2.Class({
	
	commentSchema: null,
	
	dispatchService: null,
	
	lastDoc: null,
	
	lastDivId: null,
	
	lastDisplay: null,
	
	initialize: function(opts_){
		
		var opts = $n2.extend({
			schema: null
			,dispatchService: null
		},opts_);
		
		var _this = this;
		
		this.commentSchema = opts.schema;
		this.dispatchService = opts.dispatchService;
		
		if( this.dispatchService ){
			var f = function(msg, addr, dispatcher){
				_this._handleDispatch(msg, addr, dispatcher);
			};
			this.dispatchService.register(DH, 'documentContent', f);
		};
	},
	
	display: function(opts_){
		var opts = $n2.extend({
			divId: null
			,div: null
			,display: null
			,doc: null
			,schema: null
		},opts_);
		
		var _this = this;
		
		var display = opts.display;
		var doc = opts.doc;
		var docId = doc._id;
		var documentSource = display.documentSource;
		var showService = display.showService;
		
		var $elem = opts.div;
		if( ! $elem ) {
			$elem = $('#'+opts.divId);
		};
		if( ! $elem.length) {
			return;
		};
		if( !showService ) {
			$n2.log('Show service not available for comment process');
			return;
		};
		
		this.lastDoc = doc;
		this.lastDivId = $n2.utils.getElementIdentifier($elem);
		this.lastDisplay = display;

		// Get references
		documentSource.getReferencesFromOrigin({
			docId: docId
			,onSuccess: loadedDocIds
		});
		
		function loadedDocIds(refDocIds){
			// Get documents that include comments
			documentSource.getDocumentInfoFromIds({
				docIds: refDocIds
				,onSuccess: loadedDocInfos
			});
		};
		
		function loadedDocInfos(docInfos){
			// Sort comments by last updated time
			docInfos.sort(function(a,b){
				var aTime = a.updatedTime;
				if( !aTime ){
					aTime = a.createdTime;
				};

				var bTime = b.updatedTime;
				if( !bTime ){
					bTime = b.createdTime;
				};
				
				if( aTime && bTime ){
					return bTime - aTime;
				};
				if( aTime ) return -1;
				if( bTime ) return 1;
				
				if( a.id > b.id ) {
					return 1;
				}
				return -1;
			});

			// Display comments
			$elem.empty();
			for(var i=0,e=docInfos.length; i<e; ++i){
				var docInfo = docInfos[i];
				var docId = docInfo.id;
				var $commentDiv = $('<div>')
					.addClass('n2DisplayComment_doc n2DisplayComment_doc_'+$n2.utils.stringToHtmlId(docId))
					.attr('n2DocId',docId)
					.appendTo($elem);
				var $content = $('<div>')
					.addClass('n2DisplayComment_content')
					.appendTo($commentDiv);
				showService.printDocument($content, docId);

				var $buttons = $('<div>')
					.addClass('n2DisplayComment_buttons')
					.appendTo($commentDiv);
				
				$('<a>')
					.attr('href','#')
					.text( _loc('Reply') )
					.addClass('n2DisplayComment_button_reply')
					.appendTo($buttons)
					.click(function(){
						var docId = $(this).parents('.n2DisplayComment_doc').attr('n2DocId');
						_this._addReply(docId, display);
						return false;
					});
				
				$('<a>')
					.attr('href','#')
					.text( _loc('More Details') )
					.addClass('n2DisplayComment_button_focus')
					.appendTo($buttons)
					.click(function(){
						var docId = $(this).parents('.n2DisplayComment_doc').attr('n2DocId');
						_this._changeFocus(docId, display);
						return false;
					});
			};
		};
	},
	
	addButton: function(opts_){
		var opts = $n2.extend({
			display: null
			,div: null
			,doc: null
			,schema: null
		},opts_);
		
		var _this = this;
		
		var display = opts.display;
		var doc = opts.doc;
		var $buttons = $(opts.div);
		
 		// Show 'add comment' button
		var $button = $('<a href="#"></a>')
			.text( _loc('Add Comment') )
			.appendTo($buttons)
			.click(function(){
				_this._addComment(doc, display);
				return false;
			});

		$button.addClass('nunaliit_form_link');
		$button.addClass('nunaliit_form_link_add_related_item');
	},
	
	_addComment: function(doc, display){
		var createRelatedDocProcess = display.createRelatedDocProcess;
		createRelatedDocProcess.replyToDocument({
			doc: doc
			,schema: this.commentSchema
			,origin: doc._id
		});
	},
	
	_addReply: function(docId, display){
		var _this = this;
		var documentSource = display.documentSource;
		var createRelatedDocProcess = display.createRelatedDocProcess;
		
		documentSource.getDocument({
			docId: docId
			,onSuccess: function(doc){
				createRelatedDocProcess.replyToDocument({
					doc: doc
					,schema: _this.commentSchema
				});
			}
		});
	},
	
	_changeFocus: function(docId, display){
		var _this = this;

		display._dispatch({
			type: 'userSelect'
			,docId: docId
		});
	},
	
	_handleDispatch: function(m, address, dispatcher){
		if( 'documentContent' === m.type ){
			var doc = m.doc;
			this._handleDocumentContent(doc);
		};
	},
	
	_handleDocumentContent: function(doc){
		if( doc.nunaliit_origin ){
			// Check if we should add an entry for this document
			if( doc.nunaliit_origin.doc === this.lastDoc._id ){
				// Related. Check if we are still displaying comments
				var $section = $('#'+this.lastDivId);
				if( $section.length > 0 ){
					var $entry = $section.find('.n2DisplayComment_doc_'+$n2.utils.stringToHtmlId(doc._id));
					if( $entry.length < 1 ){
						// OK, need to add a comment entry. Refresh.
						this.display({
							divId: this.lastDivId
							,display: this.lastDisplay
							,doc: this.lastDoc
							,schema: null
						});
					};
				};
			};
		};
	}
});

//===================================================================================

var TreeDocumentViewer = $n2.Class({
	
	doc: null,
	
	initialize: function(opts_){
		var opts = $n2.extend({
			doc: null
		},opts_);
		
		this.doc = opts.doc;
		
		this._display();
	},
	
	_display: function(){
		var $dialog = $('<div>')
			.addClass('n2Display_treeViewer_dialog');
		var diagId = $n2.utils.getElementIdentifier($dialog);
		
		var $container = $('<div>')
			.addClass('n2Display_treeViewer_content')
			.appendTo($dialog);
		
		new $n2.tree.ObjectTree($container, this.doc);
		
		var $buttons = $('<div>')
			.addClass('n2Display_treeViewer_buttons')
			.appendTo($dialog);
		
		$('<button>')
			.text( _loc('Close') )
			.appendTo($buttons)
			.click(function(){
				var $diag = $('#'+diagId);
				$diag.dialog('close');
				return false;
			});
		
		$dialog.dialog({
			autoOpen: true
			,title: _loc('Tree View')
			,modal: true
			,width: 370
			,close: function(event, ui){
				var diag = $(event.target);
				diag.dialog('destroy');
				diag.remove();
			}
		});
	}
});

//===================================================================================

// Exports
$n2.couchDisplay = {
	Display: Display,
	CommentRelatedInfo: CommentRelatedInfo,
	TreeDocumentViewer: TreeDocumentViewer
//	DisplayRelatedInfo: DisplayRelatedInfo,
//	DisplayLinkedInfo: DisplayLinkedInfo
	
};

})(jQuery,nunaliit2);