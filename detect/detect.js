//xml structure
var elements = {};
var attributes = {};

//detect XML structure from XML data
//return structure object (elements, attributes, root)
function detectSchema(xmlData, parser) {
  elements = new Array();
  attributes = new Array();
  var entryRoot = null;

  var options = {
    attributeNamePrefix : "",
    attrNodeName: false,
    textNodeName: "#text",
    ignoreAttributes: false,
    ignoreNameSpace: false,
    allowBooleanAttributes: false,
    parseNodeValue: true,
    parseAttributeValue: false,
    trimValues: true,
    cdataTagName: false,
    cdataPositionChar: "\\c",
    localeRange: "", 
    parseTrueNumberOnly: false,
  };

  if (parser.validate(xmlData)=== true) {
    var tObj = parser.getTraversalObj(xmlData, options);
    //detect if we have root element or several entry elements without root
    var entries = null;
    if (Object.values(tObj.child)[0].length == 1) {
      //have root element, use root's child
      var childObj = Object.values(tObj.child)[0][0].child;
      entries = Object.values(childObj)[0];
      entryRoot = Object.keys(childObj)[0];
    } else {
      entries = Object.values(tObj.child)[0];
      entryRoot = Object.keys(tObj.child)[0];
    }
    //now we have entries array, traverse
    entries.forEach(function(entry) {
      parseLevel(entry);
    });

  }
  var structElements = Object.values(elements);
  var structAttributes = new Array();
  Object.values(attributes).forEach(function(val) {
    structAttributes.push(Object.values(val)[0]);
  });
  var xmlStructure = {elements: structElements, attributes: structAttributes, root: entryRoot};  
  return xmlStructure;
}

function parseLevel(elementObj) {
  //create default element object
  if (elements[elementObj.tagname] == undefined) {
    elements[elementObj.tagname] = {name: elementObj.tagname, hasText: false, children: null};
  }
  //if some element has value, update hasText
  if (elementObj.val != '') {
    elements[elementObj.tagname].hasText = true;
  }
  //check existing children array and add new one
  var childrenEl = new Array();
  if (elements[elementObj.tagname].children != null) {
    childrenEl = elements[elementObj.tagname].children.children;
  }
  //detect children
  for (var childName in elementObj.child) {
    //console.log(childName)
    //add new child element
    var findChild = childrenEl.find(function(xe) {return xe.children.includes(childName)});
    if (findChild == undefined) {
      var maxRepeat = 1;
      if (elementObj.child[childName].length > 1) {
        maxRepeat = null;
      }
      var childNew = {minRepeat: 1, maxRepeat: maxRepeat, type: 'element', children:new Array(childName)}
      childrenEl.push(childNew);
    } else {
      //if we find more repeats of element which previously was max=1
      //change to max=null
      if (findChild.maxRepeat == 1 && elementObj.child[childName].length > 1) {
        findChild.maxRepeat = null;
        var changeIndex = childrenEl.findIndex(function(xe) {return xe.children.includes(childName)});
        childrenEl.splice(changeIndex-1, 1, findChild);
      }
    }
    //are some previously detected children missing in this element?
    //set min=0 for them
    childrenEl.forEach(function(childEl) {
      if (elementObj.child[childEl.children[0]] == undefined) {
        childEl.minRepeat = 0;
      }
    });
    //update child elements
    if (elements[elementObj.tagname].children == null && childrenEl.length > 0) {
      elements[elementObj.tagname].children = {type:'sequence', children: new Array(), minRepeat: 1, maxRepeat: 1};
    }
    elements[elementObj.tagname].children.children = childrenEl;
  }

  //detect attributes
  if (elementObj.attrsMap != undefined) {
    if (attributes[elementObj.tagname] == undefined) {
      attributes[elementObj.tagname] = {};
    }
  }
  for (var attrName in elementObj.attrsMap) {
    //console.log(attrName)
    //create default attribute object
    if (attributes[elementObj.tagname][attrName] == undefined) {
      attributes[elementObj.tagname][attrName] = {element:elementObj.tagname, name:attrName, defaultValue:null, required:true, readOnly:false, options:null};
    }
  }
  //if existing attribute is not used for this element, make it optional
  for (var attrName in attributes[elementObj.tagname]) {
    if (elementObj.attrsMap[attrName] == undefined || elementObj.attrsMap[attrName] == "") {
      attributes[elementObj.tagname][attrName].required = false;
    }
  }
  //console.log(attributes[elementObj.tagname])
  
  //parse children
  for (var childName in elementObj.child) {
    elementObj.child[childName].forEach(function(childObj) {
        parseLevel(childObj);
    });
  }
  //console.log(elements[elementObj.tagname].children)
}

try {
module.exports = {
  detectSchema: function(xmlData, parser) {
    return detectSchema(xmlData, parser);
  }
}
} catch(e) {}

