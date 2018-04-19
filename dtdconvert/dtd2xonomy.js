//element name
var nameRe = '[:A-Z_a-z][:A-Z_a-z.\\-0-9]*';
//element content
var contentRe = 'ANY|EMPTY|\\([:A-Z_a-z.\\-0-9#|?,\\s+*()]*\\)[+*?]?';
var atDefinitionRe = '\\s*('+nameRe+')\\s+(CDATA|ID|IDREF|ENTITY|ENTITIES|NMTOKEN|NMTOKENS|[|\\(\\)\\S]+)\\s+(#REQUIRED|#IMPLIED|#FIXED [\'"\\S]+|[\'"\\S]+)';
//element definition
var elRe = '<!ELEMENT\\s+('+nameRe+')\\s+('+contentRe+')\\s*>';
//attribute definition
var atRe = '<!ATTLIST\\s+('+nameRe+')\\s+(('+atDefinitionRe+')+)\\s*>';
var elements = new Array();
var attributes = new Array();
var usedChildren = new Array();

//parse single element definition
//returns object: element name; can element include text; children structure
function parseElement(text) {
  var elRegex = new RegExp(elRe, 'g');
  var results = elRegex.exec(text);
  if (results == null) return null;
  var elName = results[1];
  var content = results[2];
  var hasText = false;
  var children = null;
  if (content == 'ANY' || content.includes('#PCDATA')) {
    hasText = true;
  }
  if (content.startsWith('(') && content != '(#PCDATA)') {
    children = parseElementContent(content);
  }
  return {name:elName, hasText:hasText, children:children};
}

//parse single attlist, may have more attributes
function parseAttribute(text) {
  var atRegex = new RegExp(atRe, 'gm');
  var results = atRegex.exec(text);
  if (results == null) return null;
  var elName = results[1];
  var atDef = results[2];
  //parse each attribute definition
  var atDefRegex = new RegExp('('+atDefinitionRe+')', 'mg');
  var resultsDef = atDef.match(atDefRegex);
  if (resultsDef != null) resultsDef.forEach(function(atDefMatch){
    var atSingleRegex = new RegExp(atDefinitionRe, 'm');
    var resultsAt = atDefMatch.match(atSingleRegex);
    var atName = resultsAt[1];
    var isReadOnly = false;
    var isRequired  = false;
    var menu = null;
    var defaultValue = null;
    if (resultsAt[3].includes('#FIXED')) {
      isReadOnly = true;
    }
    if (resultsAt[3].includes('#REQUIRED')) {
      isRequired = true;
    }
    if (resultsAt[2].startsWith('(')) {
      menu = resultsAt[2].substr(1,(resultsAt[2].length-2)).split('|');
    }
    if (!(resultsAt[3].startsWith('#'))) {
      defaultValue = resultsAt[3].substr(1,(resultsAt[3].length-2));
    }
    attributes.push({element:elName, name:atName, defaultValue:defaultValue, required:isRequired, readOnly:isReadOnly, options:menu});
  });
}

//parse content of element children spec, return object
function parseElementContent(elContent) {
  var childrenArray = new Array();
  //not interested in text content here
  elContent = elContent.replace(/#PCDATA\s*\|/, '').trim();
  var minRepeat, maxRepeat = null;
  //detect min and max repeat from last character
  switch(elContent.slice(-1)) {
  case '?':
    minRepeat = 0;
    maxRepeat = 1;
    elContent = elContent.substr(0,(elContent.length-1));
    break;
  case '*':
    minRepeat = 0;
    maxRepeat = null;
    elContent = elContent.substr(0,(elContent.length-1));
    break;
  case '+':
    minRepeat = 1;
    maxRepeat = null;
    elContent = elContent.substr(0,(elContent.length-1));
    break;
  default:
    minRepeat = 1;
    maxRepeat = 1;
    break;
  }
  //if enclosed in parentheses, remove them
  if (elContent.charAt(0) == '(') {
    elContent = elContent.substr(1,(elContent.length-2));
  }

  var type = 'element';
  //try to split by |, if more than one, we treat content as choice
  if (SplitBalanced(elContent,'\\|').length>1) {
    type = 'choice';
    SplitBalanced(elContent, '\\|').forEach(function(splitPart){
      childrenArray.push(parseElementContent(splitPart.trim()));
    });
  } else {
    //otherwise try to split by , and treat content as sequence
    if (SplitBalanced(elContent,",").length>1) {
      type = 'sequence';
      SplitBalanced(elContent, ",").forEach(function(splitPart){
        childrenArray.push(parseElementContent(splitPart.trim()));
      });
    } else {
      //if not choice or sequence, this must be element
      childrenArray.push(elContent);
      usedChildren.push(elContent);
    }
  }
  var result = {minRepeat:minRepeat, maxRepeat:maxRepeat, type:type, children:childrenArray}
  return result;
}

function SplitBalanced(input, split, open, close, toggle, escape) {
    // Build the pattern from params with defaults:
    var pattern = "([\\s\\S]*?)(e)?(?:(o)|(c)|(t)|(sp)|$)"
                    .replace("sp", split)
                    .replace("o", open || "[\\(\\{\\[]")
                    .replace("c", close || "[\\)\\}\\]]")
                    .replace("t", toggle || "['\"]")
                    .replace("e", escape || "[\\\\]");
    var r = new RegExp(pattern, "gi");
    var stack = [];
    var buffer = [];
    var results = [];
    input.replace(r, function($0,$1,$e,$o,$c,$t,$s,i){
        if ($e) { // Escape
            buffer.push($1, $s || $o || $c || $t);
            return;
        }
        else if ($o) // Open
            stack.push($o);
        else if ($c) // Close
            stack.pop();
        else if ($t) { // Toggle
            if (stack[stack.length-1] !== $t)
                stack.push($t);
            else
                stack.pop();
        }
        else { // Split (if no stack) or EOF
            if ($s ? !stack.length : !$1) {
               buffer.push($1);
               results.push(buffer.join(""));
               buffer = [];
               return;
            }
        }
        buffer.push($0);
    });
    return results;
}

//parse DTD in text string to structure object
function parseDTD(dtdData) {
  //find element definitions and parse each definition to get [name,hastext,children]
  var elRegex = new RegExp('('+elRe+')', 'gm');
  var results = dtdData.match(elRegex);
  if (results != null) results.forEach(function(elMatch){
    var elResult = parseElement(elMatch);
    if (elResult != null) {
      elements.push(elResult);
    }
  });

  //find attribute definitions and parse each definition to get [element,name,options]
  var atRegex = new RegExp('('+atRe+')', 'gm');
  var results = dtdData.match(atRegex);
  if (results != null) results.forEach(function(atMatch){
    var atResult = parseAttribute(atMatch);
  });

  //root element is the element not appearing in children list
  var root = null;
  elements.forEach(function(item){
    if (!usedChildren.includes(item.name)) {
      root = item.name;
    }
  });
  var xmlStructure = {elements: elements, attributes: attributes, root:root};
  return xmlStructure;
}

//transform xml structure to Xonomy docSpec
function struct2Xonomy(xmlStructure) {
}


//transform xml structure to Lexonomy Xema
function struct2Xema(xmlStructure) {
  var xema = {root: xmlStructure.root, elements: {}};

  //add information for elements
  xmlStructure.elements.forEach(function(itemEl) {
    var objectEl = {filling: '', values: [], children: [], attributes: {}};
    //select element type: inl=text+children, txt=text only, chd=children only
    if (itemEl.hasText) {
      if (itemEl.children != null) {
        objectEl.filling = 'inl';
      } else {
        objectEl.filling = 'txt';
      }
    } else {
      if (itemEl.children != null) {
        objectEl.filling = 'chd';
      } else {
        objectEl.filling = 'emp';
      }
    }
    //add children, flattened, throw away choice and sequence
    if (itemEl.children != null) {
      objectEl.children = getFlatChildren(itemEl);
    }
    //add attributes for current element
    xmlStructure.attributes.filter(function(obj) {return obj.element == itemEl.name;}).forEach(function(itemAt) {
      var objectAt = {optionality: 'optional', filling: 'txt'};
      if (itemAt.required) {
        objectAt.optionality = 'obligatory';
      }
      if (itemAt.options != null) {
        objectAt.filling = 'lst';
        objectAt.values = new Array();
        itemAt.options.forEach(function(itemOp) {
          objectAt.values.push({value: itemOp, caption: itemOp});
        });
      }
      objectEl.attributes[itemAt.name] = objectAt;
    });
    xema.elements[itemEl.name] = objectEl;
  });
  return xema;
}

//return list of children elements, ignore complex structure
function getFlatChildren(element) {
  var childrenResult = new Array();
  childrenResult = getFlatLevel(element.children, childrenResult);
  return childrenResult;
}

//flatten one level of children spec
function getFlatLevel(childrenLevel, resultList, topMin, topMax) {
  //min and max from outermost spec can override
  if (topMin == undefined) {
    if (childrenLevel.minRepeat == null) {
      var topMin = 0;
    } else {
      var topMin = childrenLevel.minRepeat;
    }
  }
  if (topMax == undefined) {
    if (childrenLevel.maxRepeat == null) {
      var topMax = 0;
    } else {
      var topMax = childrenLevel.maxRepeat;
    }
  }
  //add element to the result list, with properties
  //choice and sequence process recursively
  if (childrenLevel.type == 'element') {
    var min = 0;
    var max = 0;
    if (childrenLevel.minRepeat != null && topMin != 0) min = childrenLevel.minRepeat;
    if (childrenLevel.maxRepeat != null && topMax != 0) max = childrenLevel.maxRepeat;
    resultList.push({name: childrenLevel.children[0], min: min, max: max});
  } else {
    childrenLevel.children.forEach(function(itemCh) {
        resultList = getFlatLevel(itemCh, resultList, topMin, topMax);
    });
  }
  return resultList;
}

module.exports = {
  dtd2xonomy: function(dtdData) {
    var xmlStructure = parseDTD(dtdData);
    //console.log(xmlStructure)
    //var spec = struct2Xonomy(xmlStructure);
    //console.log(spec)
    var xema = struct2Xema(xmlStructure);
    console.log(JSON.stringify(xema,undefined,1))
  }
}
