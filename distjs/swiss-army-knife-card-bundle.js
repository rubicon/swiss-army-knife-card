/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * True if the custom elements polyfill is in use.
 */
const isCEPolyfill = typeof window !== 'undefined' &&
    window.customElements != null &&
    window.customElements.polyfillWrapFlushCallback !==
        undefined;
/**
 * Reparents nodes, starting from `start` (inclusive) to `end` (exclusive),
 * into another container (could be the same container), before `before`. If
 * `before` is null, it appends the nodes to the container.
 */
const reparentNodes = (container, start, end = null, before = null) => {
    while (start !== end) {
        const n = start.nextSibling;
        container.insertBefore(start, before);
        start = n;
    }
};
/**
 * Removes nodes, starting from `start` (inclusive) to `end` (exclusive), from
 * `container`.
 */
const removeNodes = (container, start, end = null) => {
    while (start !== end) {
        const n = start.nextSibling;
        container.removeChild(start);
        start = n;
    }
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * An expression marker with embedded unique key to avoid collision with
 * possible text in templates.
 */
const marker = `{{lit-${String(Math.random()).slice(2)}}}`;
/**
 * An expression marker used text-positions, multi-binding attributes, and
 * attributes with markup-like text values.
 */
const nodeMarker = `<!--${marker}-->`;
const markerRegex = new RegExp(`${marker}|${nodeMarker}`);
/**
 * Suffix appended to all bound attribute names.
 */
const boundAttributeSuffix = '$lit$';
/**
 * An updatable Template that tracks the location of dynamic parts.
 */
class Template {
    constructor(result, element) {
        this.parts = [];
        this.element = element;
        const nodesToRemove = [];
        const stack = [];
        // Edge needs all 4 parameters present; IE11 needs 3rd parameter to be null
        const walker = document.createTreeWalker(element.content, 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */, null, false);
        // Keeps track of the last index associated with a part. We try to delete
        // unnecessary nodes, but we never want to associate two different parts
        // to the same index. They must have a constant node between.
        let lastPartIndex = 0;
        let index = -1;
        let partIndex = 0;
        const { strings, values: { length } } = result;
        while (partIndex < length) {
            const node = walker.nextNode();
            if (node === null) {
                // We've exhausted the content inside a nested template element.
                // Because we still have parts (the outer for-loop), we know:
                // - There is a template in the stack
                // - The walker will find a nextNode outside the template
                walker.currentNode = stack.pop();
                continue;
            }
            index++;
            if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
                if (node.hasAttributes()) {
                    const attributes = node.attributes;
                    const { length } = attributes;
                    // Per
                    // https://developer.mozilla.org/en-US/docs/Web/API/NamedNodeMap,
                    // attributes are not guaranteed to be returned in document order.
                    // In particular, Edge/IE can return them out of order, so we cannot
                    // assume a correspondence between part index and attribute index.
                    let count = 0;
                    for (let i = 0; i < length; i++) {
                        if (endsWith(attributes[i].name, boundAttributeSuffix)) {
                            count++;
                        }
                    }
                    while (count-- > 0) {
                        // Get the template literal section leading up to the first
                        // expression in this attribute
                        const stringForPart = strings[partIndex];
                        // Find the attribute name
                        const name = lastAttributeNameRegex.exec(stringForPart)[2];
                        // Find the corresponding attribute
                        // All bound attributes have had a suffix added in
                        // TemplateResult#getHTML to opt out of special attribute
                        // handling. To look up the attribute value we also need to add
                        // the suffix.
                        const attributeLookupName = name.toLowerCase() + boundAttributeSuffix;
                        const attributeValue = node.getAttribute(attributeLookupName);
                        node.removeAttribute(attributeLookupName);
                        const statics = attributeValue.split(markerRegex);
                        this.parts.push({ type: 'attribute', index, name, strings: statics });
                        partIndex += statics.length - 1;
                    }
                }
                if (node.tagName === 'TEMPLATE') {
                    stack.push(node);
                    walker.currentNode = node.content;
                }
            }
            else if (node.nodeType === 3 /* Node.TEXT_NODE */) {
                const data = node.data;
                if (data.indexOf(marker) >= 0) {
                    const parent = node.parentNode;
                    const strings = data.split(markerRegex);
                    const lastIndex = strings.length - 1;
                    // Generate a new text node for each literal section
                    // These nodes are also used as the markers for node parts
                    for (let i = 0; i < lastIndex; i++) {
                        let insert;
                        let s = strings[i];
                        if (s === '') {
                            insert = createMarker();
                        }
                        else {
                            const match = lastAttributeNameRegex.exec(s);
                            if (match !== null && endsWith(match[2], boundAttributeSuffix)) {
                                s = s.slice(0, match.index) + match[1] +
                                    match[2].slice(0, -boundAttributeSuffix.length) + match[3];
                            }
                            insert = document.createTextNode(s);
                        }
                        parent.insertBefore(insert, node);
                        this.parts.push({ type: 'node', index: ++index });
                    }
                    // If there's no text, we must insert a comment to mark our place.
                    // Else, we can trust it will stick around after cloning.
                    if (strings[lastIndex] === '') {
                        parent.insertBefore(createMarker(), node);
                        nodesToRemove.push(node);
                    }
                    else {
                        node.data = strings[lastIndex];
                    }
                    // We have a part for each match found
                    partIndex += lastIndex;
                }
            }
            else if (node.nodeType === 8 /* Node.COMMENT_NODE */) {
                if (node.data === marker) {
                    const parent = node.parentNode;
                    // Add a new marker node to be the startNode of the Part if any of
                    // the following are true:
                    //  * We don't have a previousSibling
                    //  * The previousSibling is already the start of a previous part
                    if (node.previousSibling === null || index === lastPartIndex) {
                        index++;
                        parent.insertBefore(createMarker(), node);
                    }
                    lastPartIndex = index;
                    this.parts.push({ type: 'node', index });
                    // If we don't have a nextSibling, keep this node so we have an end.
                    // Else, we can remove it to save future costs.
                    if (node.nextSibling === null) {
                        node.data = '';
                    }
                    else {
                        nodesToRemove.push(node);
                        index--;
                    }
                    partIndex++;
                }
                else {
                    let i = -1;
                    while ((i = node.data.indexOf(marker, i + 1)) !== -1) {
                        // Comment node has a binding marker inside, make an inactive part
                        // The binding won't work, but subsequent bindings will
                        // TODO (justinfagnani): consider whether it's even worth it to
                        // make bindings in comments work
                        this.parts.push({ type: 'node', index: -1 });
                        partIndex++;
                    }
                }
            }
        }
        // Remove text binding nodes after the walk to not disturb the TreeWalker
        for (const n of nodesToRemove) {
            n.parentNode.removeChild(n);
        }
    }
}
const endsWith = (str, suffix) => {
    const index = str.length - suffix.length;
    return index >= 0 && str.slice(index) === suffix;
};
const isTemplatePartActive = (part) => part.index !== -1;
// Allows `document.createComment('')` to be renamed for a
// small manual size-savings.
const createMarker = () => document.createComment('');
/**
 * This regex extracts the attribute name preceding an attribute-position
 * expression. It does this by matching the syntax allowed for attributes
 * against the string literal directly preceding the expression, assuming that
 * the expression is in an attribute-value position.
 *
 * See attributes in the HTML spec:
 * https://www.w3.org/TR/html5/syntax.html#elements-attributes
 *
 * " \x09\x0a\x0c\x0d" are HTML space characters:
 * https://www.w3.org/TR/html5/infrastructure.html#space-characters
 *
 * "\0-\x1F\x7F-\x9F" are Unicode control characters, which includes every
 * space character except " ".
 *
 * So an attribute is:
 *  * The name: any character except a control character, space character, ('),
 *    ("), ">", "=", or "/"
 *  * Followed by zero or more space characters
 *  * Followed by "="
 *  * Followed by zero or more space characters
 *  * Followed by:
 *    * Any character except space, ('), ("), "<", ">", "=", (`), or
 *    * (") then any non-("), or
 *    * (') then any non-(')
 */
const lastAttributeNameRegex = 
// eslint-disable-next-line no-control-regex
/([ \x09\x0a\x0c\x0d])([^\0-\x1F\x7F-\x9F "'>=/]+)([ \x09\x0a\x0c\x0d]*=[ \x09\x0a\x0c\x0d]*(?:[^ \x09\x0a\x0c\x0d"'`<>=]*|"[^"]*|'[^']*))$/;

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const walkerNodeFilter = 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */;
/**
 * Removes the list of nodes from a Template safely. In addition to removing
 * nodes from the Template, the Template part indices are updated to match
 * the mutated Template DOM.
 *
 * As the template is walked the removal state is tracked and
 * part indices are adjusted as needed.
 *
 * div
 *   div#1 (remove) <-- start removing (removing node is div#1)
 *     div
 *       div#2 (remove)  <-- continue removing (removing node is still div#1)
 *         div
 * div <-- stop removing since previous sibling is the removing node (div#1,
 * removed 4 nodes)
 */
function removeNodesFromTemplate(template, nodesToRemove) {
    const { element: { content }, parts } = template;
    const walker = document.createTreeWalker(content, walkerNodeFilter, null, false);
    let partIndex = nextActiveIndexInTemplateParts(parts);
    let part = parts[partIndex];
    let nodeIndex = -1;
    let removeCount = 0;
    const nodesToRemoveInTemplate = [];
    let currentRemovingNode = null;
    while (walker.nextNode()) {
        nodeIndex++;
        const node = walker.currentNode;
        // End removal if stepped past the removing node
        if (node.previousSibling === currentRemovingNode) {
            currentRemovingNode = null;
        }
        // A node to remove was found in the template
        if (nodesToRemove.has(node)) {
            nodesToRemoveInTemplate.push(node);
            // Track node we're removing
            if (currentRemovingNode === null) {
                currentRemovingNode = node;
            }
        }
        // When removing, increment count by which to adjust subsequent part indices
        if (currentRemovingNode !== null) {
            removeCount++;
        }
        while (part !== undefined && part.index === nodeIndex) {
            // If part is in a removed node deactivate it by setting index to -1 or
            // adjust the index as needed.
            part.index = currentRemovingNode !== null ? -1 : part.index - removeCount;
            // go to the next active part.
            partIndex = nextActiveIndexInTemplateParts(parts, partIndex);
            part = parts[partIndex];
        }
    }
    nodesToRemoveInTemplate.forEach((n) => n.parentNode.removeChild(n));
}
const countNodes = (node) => {
    let count = (node.nodeType === 11 /* Node.DOCUMENT_FRAGMENT_NODE */) ? 0 : 1;
    const walker = document.createTreeWalker(node, walkerNodeFilter, null, false);
    while (walker.nextNode()) {
        count++;
    }
    return count;
};
const nextActiveIndexInTemplateParts = (parts, startIndex = -1) => {
    for (let i = startIndex + 1; i < parts.length; i++) {
        const part = parts[i];
        if (isTemplatePartActive(part)) {
            return i;
        }
    }
    return -1;
};
/**
 * Inserts the given node into the Template, optionally before the given
 * refNode. In addition to inserting the node into the Template, the Template
 * part indices are updated to match the mutated Template DOM.
 */
function insertNodeIntoTemplate(template, node, refNode = null) {
    const { element: { content }, parts } = template;
    // If there's no refNode, then put node at end of template.
    // No part indices need to be shifted in this case.
    if (refNode === null || refNode === undefined) {
        content.appendChild(node);
        return;
    }
    const walker = document.createTreeWalker(content, walkerNodeFilter, null, false);
    let partIndex = nextActiveIndexInTemplateParts(parts);
    let insertCount = 0;
    let walkerIndex = -1;
    while (walker.nextNode()) {
        walkerIndex++;
        const walkerNode = walker.currentNode;
        if (walkerNode === refNode) {
            insertCount = countNodes(node);
            refNode.parentNode.insertBefore(node, refNode);
        }
        while (partIndex !== -1 && parts[partIndex].index === walkerIndex) {
            // If we've inserted the node, simply adjust all subsequent parts
            if (insertCount > 0) {
                while (partIndex !== -1) {
                    parts[partIndex].index += insertCount;
                    partIndex = nextActiveIndexInTemplateParts(parts, partIndex);
                }
                return;
            }
            partIndex = nextActiveIndexInTemplateParts(parts, partIndex);
        }
    }
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const directives = new WeakMap();
/**
 * Brands a function as a directive factory function so that lit-html will call
 * the function during template rendering, rather than passing as a value.
 *
 * A _directive_ is a function that takes a Part as an argument. It has the
 * signature: `(part: Part) => void`.
 *
 * A directive _factory_ is a function that takes arguments for data and
 * configuration and returns a directive. Users of directive usually refer to
 * the directive factory as the directive. For example, "The repeat directive".
 *
 * Usually a template author will invoke a directive factory in their template
 * with relevant arguments, which will then return a directive function.
 *
 * Here's an example of using the `repeat()` directive factory that takes an
 * array and a function to render an item:
 *
 * ```js
 * html`<ul><${repeat(items, (item) => html`<li>${item}</li>`)}</ul>`
 * ```
 *
 * When `repeat` is invoked, it returns a directive function that closes over
 * `items` and the template function. When the outer template is rendered, the
 * return directive function is called with the Part for the expression.
 * `repeat` then performs it's custom logic to render multiple items.
 *
 * @param f The directive factory function. Must be a function that returns a
 * function of the signature `(part: Part) => void`. The returned function will
 * be called with the part object.
 *
 * @example
 *
 * import {directive, html} from 'lit-html';
 *
 * const immutable = directive((v) => (part) => {
 *   if (part.value !== v) {
 *     part.setValue(v)
 *   }
 * });
 */
const directive = (f) => ((...args) => {
    const d = f(...args);
    directives.set(d, true);
    return d;
});
const isDirective = (o) => {
    return typeof o === 'function' && directives.has(o);
};

/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * A sentinel value that signals that a value was handled by a directive and
 * should not be written to the DOM.
 */
const noChange = {};
/**
 * A sentinel value that signals a NodePart to fully clear its content.
 */
const nothing = {};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * An instance of a `Template` that can be attached to the DOM and updated
 * with new values.
 */
class TemplateInstance {
    constructor(template, processor, options) {
        this.__parts = [];
        this.template = template;
        this.processor = processor;
        this.options = options;
    }
    update(values) {
        let i = 0;
        for (const part of this.__parts) {
            if (part !== undefined) {
                part.setValue(values[i]);
            }
            i++;
        }
        for (const part of this.__parts) {
            if (part !== undefined) {
                part.commit();
            }
        }
    }
    _clone() {
        // There are a number of steps in the lifecycle of a template instance's
        // DOM fragment:
        //  1. Clone - create the instance fragment
        //  2. Adopt - adopt into the main document
        //  3. Process - find part markers and create parts
        //  4. Upgrade - upgrade custom elements
        //  5. Update - set node, attribute, property, etc., values
        //  6. Connect - connect to the document. Optional and outside of this
        //     method.
        //
        // We have a few constraints on the ordering of these steps:
        //  * We need to upgrade before updating, so that property values will pass
        //    through any property setters.
        //  * We would like to process before upgrading so that we're sure that the
        //    cloned fragment is inert and not disturbed by self-modifying DOM.
        //  * We want custom elements to upgrade even in disconnected fragments.
        //
        // Given these constraints, with full custom elements support we would
        // prefer the order: Clone, Process, Adopt, Upgrade, Update, Connect
        //
        // But Safari does not implement CustomElementRegistry#upgrade, so we
        // can not implement that order and still have upgrade-before-update and
        // upgrade disconnected fragments. So we instead sacrifice the
        // process-before-upgrade constraint, since in Custom Elements v1 elements
        // must not modify their light DOM in the constructor. We still have issues
        // when co-existing with CEv0 elements like Polymer 1, and with polyfills
        // that don't strictly adhere to the no-modification rule because shadow
        // DOM, which may be created in the constructor, is emulated by being placed
        // in the light DOM.
        //
        // The resulting order is on native is: Clone, Adopt, Upgrade, Process,
        // Update, Connect. document.importNode() performs Clone, Adopt, and Upgrade
        // in one step.
        //
        // The Custom Elements v1 polyfill supports upgrade(), so the order when
        // polyfilled is the more ideal: Clone, Process, Adopt, Upgrade, Update,
        // Connect.
        const fragment = isCEPolyfill ?
            this.template.element.content.cloneNode(true) :
            document.importNode(this.template.element.content, true);
        const stack = [];
        const parts = this.template.parts;
        // Edge needs all 4 parameters present; IE11 needs 3rd parameter to be null
        const walker = document.createTreeWalker(fragment, 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */, null, false);
        let partIndex = 0;
        let nodeIndex = 0;
        let part;
        let node = walker.nextNode();
        // Loop through all the nodes and parts of a template
        while (partIndex < parts.length) {
            part = parts[partIndex];
            if (!isTemplatePartActive(part)) {
                this.__parts.push(undefined);
                partIndex++;
                continue;
            }
            // Progress the tree walker until we find our next part's node.
            // Note that multiple parts may share the same node (attribute parts
            // on a single element), so this loop may not run at all.
            while (nodeIndex < part.index) {
                nodeIndex++;
                if (node.nodeName === 'TEMPLATE') {
                    stack.push(node);
                    walker.currentNode = node.content;
                }
                if ((node = walker.nextNode()) === null) {
                    // We've exhausted the content inside a nested template element.
                    // Because we still have parts (the outer for-loop), we know:
                    // - There is a template in the stack
                    // - The walker will find a nextNode outside the template
                    walker.currentNode = stack.pop();
                    node = walker.nextNode();
                }
            }
            // We've arrived at our part's node.
            if (part.type === 'node') {
                const part = this.processor.handleTextExpression(this.options);
                part.insertAfterNode(node.previousSibling);
                this.__parts.push(part);
            }
            else {
                this.__parts.push(...this.processor.handleAttributeExpressions(node, part.name, part.strings, this.options));
            }
            partIndex++;
        }
        if (isCEPolyfill) {
            document.adoptNode(fragment);
            customElements.upgrade(fragment);
        }
        return fragment;
    }
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * Our TrustedTypePolicy for HTML which is declared using the html template
 * tag function.
 *
 * That HTML is a developer-authored constant, and is parsed with innerHTML
 * before any untrusted expressions have been mixed in. Therefor it is
 * considered safe by construction.
 */
const policy = window.trustedTypes &&
    trustedTypes.createPolicy('lit-html', { createHTML: (s) => s });
const commentMarker = ` ${marker} `;
/**
 * The return type of `html`, which holds a Template and the values from
 * interpolated expressions.
 */
class TemplateResult {
    constructor(strings, values, type, processor) {
        this.strings = strings;
        this.values = values;
        this.type = type;
        this.processor = processor;
    }
    /**
     * Returns a string of HTML used to create a `<template>` element.
     */
    getHTML() {
        const l = this.strings.length - 1;
        let html = '';
        let isCommentBinding = false;
        for (let i = 0; i < l; i++) {
            const s = this.strings[i];
            // For each binding we want to determine the kind of marker to insert
            // into the template source before it's parsed by the browser's HTML
            // parser. The marker type is based on whether the expression is in an
            // attribute, text, or comment position.
            //   * For node-position bindings we insert a comment with the marker
            //     sentinel as its text content, like <!--{{lit-guid}}-->.
            //   * For attribute bindings we insert just the marker sentinel for the
            //     first binding, so that we support unquoted attribute bindings.
            //     Subsequent bindings can use a comment marker because multi-binding
            //     attributes must be quoted.
            //   * For comment bindings we insert just the marker sentinel so we don't
            //     close the comment.
            //
            // The following code scans the template source, but is *not* an HTML
            // parser. We don't need to track the tree structure of the HTML, only
            // whether a binding is inside a comment, and if not, if it appears to be
            // the first binding in an attribute.
            const commentOpen = s.lastIndexOf('<!--');
            // We're in comment position if we have a comment open with no following
            // comment close. Because <-- can appear in an attribute value there can
            // be false positives.
            isCommentBinding = (commentOpen > -1 || isCommentBinding) &&
                s.indexOf('-->', commentOpen + 1) === -1;
            // Check to see if we have an attribute-like sequence preceding the
            // expression. This can match "name=value" like structures in text,
            // comments, and attribute values, so there can be false-positives.
            const attributeMatch = lastAttributeNameRegex.exec(s);
            if (attributeMatch === null) {
                // We're only in this branch if we don't have a attribute-like
                // preceding sequence. For comments, this guards against unusual
                // attribute values like <div foo="<!--${'bar'}">. Cases like
                // <!-- foo=${'bar'}--> are handled correctly in the attribute branch
                // below.
                html += s + (isCommentBinding ? commentMarker : nodeMarker);
            }
            else {
                // For attributes we use just a marker sentinel, and also append a
                // $lit$ suffix to the name to opt-out of attribute-specific parsing
                // that IE and Edge do for style and certain SVG attributes.
                html += s.substr(0, attributeMatch.index) + attributeMatch[1] +
                    attributeMatch[2] + boundAttributeSuffix + attributeMatch[3] +
                    marker;
            }
        }
        html += this.strings[l];
        return html;
    }
    getTemplateElement() {
        const template = document.createElement('template');
        let value = this.getHTML();
        if (policy !== undefined) {
            // this is secure because `this.strings` is a TemplateStringsArray.
            // TODO: validate this when
            // https://github.com/tc39/proposal-array-is-template-object is
            // implemented.
            value = policy.createHTML(value);
        }
        template.innerHTML = value;
        return template;
    }
}
/**
 * A TemplateResult for SVG fragments.
 *
 * This class wraps HTML in an `<svg>` tag in order to parse its contents in the
 * SVG namespace, then modifies the template to remove the `<svg>` tag so that
 * clones only container the original fragment.
 */
class SVGTemplateResult extends TemplateResult {
    getHTML() {
        return `<svg>${super.getHTML()}</svg>`;
    }
    getTemplateElement() {
        const template = super.getTemplateElement();
        const content = template.content;
        const svgElement = content.firstChild;
        content.removeChild(svgElement);
        reparentNodes(content, svgElement.firstChild);
        return template;
    }
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const isPrimitive = (value) => {
    return (value === null ||
        !(typeof value === 'object' || typeof value === 'function'));
};
const isIterable = (value) => {
    return Array.isArray(value) ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        !!(value && value[Symbol.iterator]);
};
/**
 * Writes attribute values to the DOM for a group of AttributeParts bound to a
 * single attribute. The value is only set once even if there are multiple parts
 * for an attribute.
 */
class AttributeCommitter {
    constructor(element, name, strings) {
        this.dirty = true;
        this.element = element;
        this.name = name;
        this.strings = strings;
        this.parts = [];
        for (let i = 0; i < strings.length - 1; i++) {
            this.parts[i] = this._createPart();
        }
    }
    /**
     * Creates a single part. Override this to create a differnt type of part.
     */
    _createPart() {
        return new AttributePart(this);
    }
    _getValue() {
        const strings = this.strings;
        const l = strings.length - 1;
        const parts = this.parts;
        // If we're assigning an attribute via syntax like:
        //    attr="${foo}"  or  attr=${foo}
        // but not
        //    attr="${foo} ${bar}" or attr="${foo} baz"
        // then we don't want to coerce the attribute value into one long
        // string. Instead we want to just return the value itself directly,
        // so that sanitizeDOMValue can get the actual value rather than
        // String(value)
        // The exception is if v is an array, in which case we do want to smash
        // it together into a string without calling String() on the array.
        //
        // This also allows trusted values (when using TrustedTypes) being
        // assigned to DOM sinks without being stringified in the process.
        if (l === 1 && strings[0] === '' && strings[1] === '') {
            const v = parts[0].value;
            if (typeof v === 'symbol') {
                return String(v);
            }
            if (typeof v === 'string' || !isIterable(v)) {
                return v;
            }
        }
        let text = '';
        for (let i = 0; i < l; i++) {
            text += strings[i];
            const part = parts[i];
            if (part !== undefined) {
                const v = part.value;
                if (isPrimitive(v) || !isIterable(v)) {
                    text += typeof v === 'string' ? v : String(v);
                }
                else {
                    for (const t of v) {
                        text += typeof t === 'string' ? t : String(t);
                    }
                }
            }
        }
        text += strings[l];
        return text;
    }
    commit() {
        if (this.dirty) {
            this.dirty = false;
            this.element.setAttribute(this.name, this._getValue());
        }
    }
}
/**
 * A Part that controls all or part of an attribute value.
 */
class AttributePart {
    constructor(committer) {
        this.value = undefined;
        this.committer = committer;
    }
    setValue(value) {
        if (value !== noChange && (!isPrimitive(value) || value !== this.value)) {
            this.value = value;
            // If the value is a not a directive, dirty the committer so that it'll
            // call setAttribute. If the value is a directive, it'll dirty the
            // committer if it calls setValue().
            if (!isDirective(value)) {
                this.committer.dirty = true;
            }
        }
    }
    commit() {
        while (isDirective(this.value)) {
            const directive = this.value;
            this.value = noChange;
            directive(this);
        }
        if (this.value === noChange) {
            return;
        }
        this.committer.commit();
    }
}
/**
 * A Part that controls a location within a Node tree. Like a Range, NodePart
 * has start and end locations and can set and update the Nodes between those
 * locations.
 *
 * NodeParts support several value types: primitives, Nodes, TemplateResults,
 * as well as arrays and iterables of those types.
 */
class NodePart {
    constructor(options) {
        this.value = undefined;
        this.__pendingValue = undefined;
        this.options = options;
    }
    /**
     * Appends this part into a container.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    appendInto(container) {
        this.startNode = container.appendChild(createMarker());
        this.endNode = container.appendChild(createMarker());
    }
    /**
     * Inserts this part after the `ref` node (between `ref` and `ref`'s next
     * sibling). Both `ref` and its next sibling must be static, unchanging nodes
     * such as those that appear in a literal section of a template.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    insertAfterNode(ref) {
        this.startNode = ref;
        this.endNode = ref.nextSibling;
    }
    /**
     * Appends this part into a parent part.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    appendIntoPart(part) {
        part.__insert(this.startNode = createMarker());
        part.__insert(this.endNode = createMarker());
    }
    /**
     * Inserts this part after the `ref` part.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    insertAfterPart(ref) {
        ref.__insert(this.startNode = createMarker());
        this.endNode = ref.endNode;
        ref.endNode = this.startNode;
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        if (this.startNode.parentNode === null) {
            return;
        }
        while (isDirective(this.__pendingValue)) {
            const directive = this.__pendingValue;
            this.__pendingValue = noChange;
            directive(this);
        }
        const value = this.__pendingValue;
        if (value === noChange) {
            return;
        }
        if (isPrimitive(value)) {
            if (value !== this.value) {
                this.__commitText(value);
            }
        }
        else if (value instanceof TemplateResult) {
            this.__commitTemplateResult(value);
        }
        else if (value instanceof Node) {
            this.__commitNode(value);
        }
        else if (isIterable(value)) {
            this.__commitIterable(value);
        }
        else if (value === nothing) {
            this.value = nothing;
            this.clear();
        }
        else {
            // Fallback, will render the string representation
            this.__commitText(value);
        }
    }
    __insert(node) {
        this.endNode.parentNode.insertBefore(node, this.endNode);
    }
    __commitNode(value) {
        if (this.value === value) {
            return;
        }
        this.clear();
        this.__insert(value);
        this.value = value;
    }
    __commitText(value) {
        const node = this.startNode.nextSibling;
        value = value == null ? '' : value;
        // If `value` isn't already a string, we explicitly convert it here in case
        // it can't be implicitly converted - i.e. it's a symbol.
        const valueAsString = typeof value === 'string' ? value : String(value);
        if (node === this.endNode.previousSibling &&
            node.nodeType === 3 /* Node.TEXT_NODE */) {
            // If we only have a single text node between the markers, we can just
            // set its value, rather than replacing it.
            // TODO(justinfagnani): Can we just check if this.value is primitive?
            node.data = valueAsString;
        }
        else {
            this.__commitNode(document.createTextNode(valueAsString));
        }
        this.value = value;
    }
    __commitTemplateResult(value) {
        const template = this.options.templateFactory(value);
        if (this.value instanceof TemplateInstance &&
            this.value.template === template) {
            this.value.update(value.values);
        }
        else {
            // Make sure we propagate the template processor from the TemplateResult
            // so that we use its syntax extension, etc. The template factory comes
            // from the render function options so that it can control template
            // caching and preprocessing.
            const instance = new TemplateInstance(template, value.processor, this.options);
            const fragment = instance._clone();
            instance.update(value.values);
            this.__commitNode(fragment);
            this.value = instance;
        }
    }
    __commitIterable(value) {
        // For an Iterable, we create a new InstancePart per item, then set its
        // value to the item. This is a little bit of overhead for every item in
        // an Iterable, but it lets us recurse easily and efficiently update Arrays
        // of TemplateResults that will be commonly returned from expressions like:
        // array.map((i) => html`${i}`), by reusing existing TemplateInstances.
        // If _value is an array, then the previous render was of an
        // iterable and _value will contain the NodeParts from the previous
        // render. If _value is not an array, clear this part and make a new
        // array for NodeParts.
        if (!Array.isArray(this.value)) {
            this.value = [];
            this.clear();
        }
        // Lets us keep track of how many items we stamped so we can clear leftover
        // items from a previous render
        const itemParts = this.value;
        let partIndex = 0;
        let itemPart;
        for (const item of value) {
            // Try to reuse an existing part
            itemPart = itemParts[partIndex];
            // If no existing part, create a new one
            if (itemPart === undefined) {
                itemPart = new NodePart(this.options);
                itemParts.push(itemPart);
                if (partIndex === 0) {
                    itemPart.appendIntoPart(this);
                }
                else {
                    itemPart.insertAfterPart(itemParts[partIndex - 1]);
                }
            }
            itemPart.setValue(item);
            itemPart.commit();
            partIndex++;
        }
        if (partIndex < itemParts.length) {
            // Truncate the parts array so _value reflects the current state
            itemParts.length = partIndex;
            this.clear(itemPart && itemPart.endNode);
        }
    }
    clear(startNode = this.startNode) {
        removeNodes(this.startNode.parentNode, startNode.nextSibling, this.endNode);
    }
}
/**
 * Implements a boolean attribute, roughly as defined in the HTML
 * specification.
 *
 * If the value is truthy, then the attribute is present with a value of
 * ''. If the value is falsey, the attribute is removed.
 */
class BooleanAttributePart {
    constructor(element, name, strings) {
        this.value = undefined;
        this.__pendingValue = undefined;
        if (strings.length !== 2 || strings[0] !== '' || strings[1] !== '') {
            throw new Error('Boolean attributes can only contain a single expression');
        }
        this.element = element;
        this.name = name;
        this.strings = strings;
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        while (isDirective(this.__pendingValue)) {
            const directive = this.__pendingValue;
            this.__pendingValue = noChange;
            directive(this);
        }
        if (this.__pendingValue === noChange) {
            return;
        }
        const value = !!this.__pendingValue;
        if (this.value !== value) {
            if (value) {
                this.element.setAttribute(this.name, '');
            }
            else {
                this.element.removeAttribute(this.name);
            }
            this.value = value;
        }
        this.__pendingValue = noChange;
    }
}
/**
 * Sets attribute values for PropertyParts, so that the value is only set once
 * even if there are multiple parts for a property.
 *
 * If an expression controls the whole property value, then the value is simply
 * assigned to the property under control. If there are string literals or
 * multiple expressions, then the strings are expressions are interpolated into
 * a string first.
 */
class PropertyCommitter extends AttributeCommitter {
    constructor(element, name, strings) {
        super(element, name, strings);
        this.single =
            (strings.length === 2 && strings[0] === '' && strings[1] === '');
    }
    _createPart() {
        return new PropertyPart(this);
    }
    _getValue() {
        if (this.single) {
            return this.parts[0].value;
        }
        return super._getValue();
    }
    commit() {
        if (this.dirty) {
            this.dirty = false;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.element[this.name] = this._getValue();
        }
    }
}
class PropertyPart extends AttributePart {
}
// Detect event listener options support. If the `capture` property is read
// from the options object, then options are supported. If not, then the third
// argument to add/removeEventListener is interpreted as the boolean capture
// value so we should only pass the `capture` property.
let eventOptionsSupported = false;
// Wrap into an IIFE because MS Edge <= v41 does not support having try/catch
// blocks right into the body of a module
(() => {
    try {
        const options = {
            get capture() {
                eventOptionsSupported = true;
                return false;
            }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window.addEventListener('test', options, options);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window.removeEventListener('test', options, options);
    }
    catch (_e) {
        // event options not supported
    }
})();
class EventPart {
    constructor(element, eventName, eventContext) {
        this.value = undefined;
        this.__pendingValue = undefined;
        this.element = element;
        this.eventName = eventName;
        this.eventContext = eventContext;
        this.__boundHandleEvent = (e) => this.handleEvent(e);
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        while (isDirective(this.__pendingValue)) {
            const directive = this.__pendingValue;
            this.__pendingValue = noChange;
            directive(this);
        }
        if (this.__pendingValue === noChange) {
            return;
        }
        const newListener = this.__pendingValue;
        const oldListener = this.value;
        const shouldRemoveListener = newListener == null ||
            oldListener != null &&
                (newListener.capture !== oldListener.capture ||
                    newListener.once !== oldListener.once ||
                    newListener.passive !== oldListener.passive);
        const shouldAddListener = newListener != null && (oldListener == null || shouldRemoveListener);
        if (shouldRemoveListener) {
            this.element.removeEventListener(this.eventName, this.__boundHandleEvent, this.__options);
        }
        if (shouldAddListener) {
            this.__options = getOptions(newListener);
            this.element.addEventListener(this.eventName, this.__boundHandleEvent, this.__options);
        }
        this.value = newListener;
        this.__pendingValue = noChange;
    }
    handleEvent(event) {
        if (typeof this.value === 'function') {
            this.value.call(this.eventContext || this.element, event);
        }
        else {
            this.value.handleEvent(event);
        }
    }
}
// We copy options because of the inconsistent behavior of browsers when reading
// the third argument of add/removeEventListener. IE11 doesn't support options
// at all. Chrome 41 only reads `capture` if the argument is an object.
const getOptions = (o) => o &&
    (eventOptionsSupported ?
        { capture: o.capture, passive: o.passive, once: o.once } :
        o.capture);

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * The default TemplateFactory which caches Templates keyed on
 * result.type and result.strings.
 */
function templateFactory(result) {
    let templateCache = templateCaches.get(result.type);
    if (templateCache === undefined) {
        templateCache = {
            stringsArray: new WeakMap(),
            keyString: new Map()
        };
        templateCaches.set(result.type, templateCache);
    }
    let template = templateCache.stringsArray.get(result.strings);
    if (template !== undefined) {
        return template;
    }
    // If the TemplateStringsArray is new, generate a key from the strings
    // This key is shared between all templates with identical content
    const key = result.strings.join(marker);
    // Check if we already have a Template for this key
    template = templateCache.keyString.get(key);
    if (template === undefined) {
        // If we have not seen this key before, create a new Template
        template = new Template(result, result.getTemplateElement());
        // Cache the Template for this key
        templateCache.keyString.set(key, template);
    }
    // Cache all future queries for this TemplateStringsArray
    templateCache.stringsArray.set(result.strings, template);
    return template;
}
const templateCaches = new Map();

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const parts = new WeakMap();
/**
 * Renders a template result or other value to a container.
 *
 * To update a container with new values, reevaluate the template literal and
 * call `render` with the new result.
 *
 * @param result Any value renderable by NodePart - typically a TemplateResult
 *     created by evaluating a template tag like `html` or `svg`.
 * @param container A DOM parent to render to. The entire contents are either
 *     replaced, or efficiently updated if the same result type was previous
 *     rendered there.
 * @param options RenderOptions for the entire render tree rendered to this
 *     container. Render options must *not* change between renders to the same
 *     container, as those changes will not effect previously rendered DOM.
 */
const render$1 = (result, container, options) => {
    let part = parts.get(container);
    if (part === undefined) {
        removeNodes(container, container.firstChild);
        parts.set(container, part = new NodePart(Object.assign({ templateFactory }, options)));
        part.appendInto(container);
    }
    part.setValue(result);
    part.commit();
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * Creates Parts when a template is instantiated.
 */
class DefaultTemplateProcessor {
    /**
     * Create parts for an attribute-position binding, given the event, attribute
     * name, and string literals.
     *
     * @param element The element containing the binding
     * @param name  The attribute name
     * @param strings The string literals. There are always at least two strings,
     *   event for fully-controlled bindings with a single expression.
     */
    handleAttributeExpressions(element, name, strings, options) {
        const prefix = name[0];
        if (prefix === '.') {
            const committer = new PropertyCommitter(element, name.slice(1), strings);
            return committer.parts;
        }
        if (prefix === '@') {
            return [new EventPart(element, name.slice(1), options.eventContext)];
        }
        if (prefix === '?') {
            return [new BooleanAttributePart(element, name.slice(1), strings)];
        }
        const committer = new AttributeCommitter(element, name, strings);
        return committer.parts;
    }
    /**
     * Create parts for a text-position binding.
     * @param templateFactory
     */
    handleTextExpression(options) {
        return new NodePart(options);
    }
}
const defaultTemplateProcessor = new DefaultTemplateProcessor();

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
// IMPORTANT: do not change the property name or the assignment expression.
// This line will be used in regexes to search for lit-html usage.
// TODO(justinfagnani): inject version number at build time
if (typeof window !== 'undefined') {
    (window['litHtmlVersions'] || (window['litHtmlVersions'] = [])).push('1.4.1');
}
/**
 * Interprets a template literal as an HTML template that can efficiently
 * render to and update a container.
 */
const html = (strings, ...values) => new TemplateResult(strings, values, 'html', defaultTemplateProcessor);
/**
 * Interprets a template literal as an SVG template that can efficiently
 * render to and update a container.
 */
const svg = (strings, ...values) => new SVGTemplateResult(strings, values, 'svg', defaultTemplateProcessor);

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
// Get a key to lookup in `templateCaches`.
const getTemplateCacheKey = (type, scopeName) => `${type}--${scopeName}`;
let compatibleShadyCSSVersion = true;
if (typeof window.ShadyCSS === 'undefined') {
    compatibleShadyCSSVersion = false;
}
else if (typeof window.ShadyCSS.prepareTemplateDom === 'undefined') {
    console.warn(`Incompatible ShadyCSS version detected. ` +
        `Please update to at least @webcomponents/webcomponentsjs@2.0.2 and ` +
        `@webcomponents/shadycss@1.3.1.`);
    compatibleShadyCSSVersion = false;
}
/**
 * Template factory which scopes template DOM using ShadyCSS.
 * @param scopeName {string}
 */
const shadyTemplateFactory = (scopeName) => (result) => {
    const cacheKey = getTemplateCacheKey(result.type, scopeName);
    let templateCache = templateCaches.get(cacheKey);
    if (templateCache === undefined) {
        templateCache = {
            stringsArray: new WeakMap(),
            keyString: new Map()
        };
        templateCaches.set(cacheKey, templateCache);
    }
    let template = templateCache.stringsArray.get(result.strings);
    if (template !== undefined) {
        return template;
    }
    const key = result.strings.join(marker);
    template = templateCache.keyString.get(key);
    if (template === undefined) {
        const element = result.getTemplateElement();
        if (compatibleShadyCSSVersion) {
            window.ShadyCSS.prepareTemplateDom(element, scopeName);
        }
        template = new Template(result, element);
        templateCache.keyString.set(key, template);
    }
    templateCache.stringsArray.set(result.strings, template);
    return template;
};
const TEMPLATE_TYPES = ['html', 'svg'];
/**
 * Removes all style elements from Templates for the given scopeName.
 */
const removeStylesFromLitTemplates = (scopeName) => {
    TEMPLATE_TYPES.forEach((type) => {
        const templates = templateCaches.get(getTemplateCacheKey(type, scopeName));
        if (templates !== undefined) {
            templates.keyString.forEach((template) => {
                const { element: { content } } = template;
                // IE 11 doesn't support the iterable param Set constructor
                const styles = new Set();
                Array.from(content.querySelectorAll('style')).forEach((s) => {
                    styles.add(s);
                });
                removeNodesFromTemplate(template, styles);
            });
        }
    });
};
const shadyRenderSet = new Set();
/**
 * For the given scope name, ensures that ShadyCSS style scoping is performed.
 * This is done just once per scope name so the fragment and template cannot
 * be modified.
 * (1) extracts styles from the rendered fragment and hands them to ShadyCSS
 * to be scoped and appended to the document
 * (2) removes style elements from all lit-html Templates for this scope name.
 *
 * Note, <style> elements can only be placed into templates for the
 * initial rendering of the scope. If <style> elements are included in templates
 * dynamically rendered to the scope (after the first scope render), they will
 * not be scoped and the <style> will be left in the template and rendered
 * output.
 */
const prepareTemplateStyles = (scopeName, renderedDOM, template) => {
    shadyRenderSet.add(scopeName);
    // If `renderedDOM` is stamped from a Template, then we need to edit that
    // Template's underlying template element. Otherwise, we create one here
    // to give to ShadyCSS, which still requires one while scoping.
    const templateElement = !!template ? template.element : document.createElement('template');
    // Move styles out of rendered DOM and store.
    const styles = renderedDOM.querySelectorAll('style');
    const { length } = styles;
    // If there are no styles, skip unnecessary work
    if (length === 0) {
        // Ensure prepareTemplateStyles is called to support adding
        // styles via `prepareAdoptedCssText` since that requires that
        // `prepareTemplateStyles` is called.
        //
        // ShadyCSS will only update styles containing @apply in the template
        // given to `prepareTemplateStyles`. If no lit Template was given,
        // ShadyCSS will not be able to update uses of @apply in any relevant
        // template. However, this is not a problem because we only create the
        // template for the purpose of supporting `prepareAdoptedCssText`,
        // which doesn't support @apply at all.
        window.ShadyCSS.prepareTemplateStyles(templateElement, scopeName);
        return;
    }
    const condensedStyle = document.createElement('style');
    // Collect styles into a single style. This helps us make sure ShadyCSS
    // manipulations will not prevent us from being able to fix up template
    // part indices.
    // NOTE: collecting styles is inefficient for browsers but ShadyCSS
    // currently does this anyway. When it does not, this should be changed.
    for (let i = 0; i < length; i++) {
        const style = styles[i];
        style.parentNode.removeChild(style);
        condensedStyle.textContent += style.textContent;
    }
    // Remove styles from nested templates in this scope.
    removeStylesFromLitTemplates(scopeName);
    // And then put the condensed style into the "root" template passed in as
    // `template`.
    const content = templateElement.content;
    if (!!template) {
        insertNodeIntoTemplate(template, condensedStyle, content.firstChild);
    }
    else {
        content.insertBefore(condensedStyle, content.firstChild);
    }
    // Note, it's important that ShadyCSS gets the template that `lit-html`
    // will actually render so that it can update the style inside when
    // needed (e.g. @apply native Shadow DOM case).
    window.ShadyCSS.prepareTemplateStyles(templateElement, scopeName);
    const style = content.querySelector('style');
    if (window.ShadyCSS.nativeShadow && style !== null) {
        // When in native Shadow DOM, ensure the style created by ShadyCSS is
        // included in initially rendered output (`renderedDOM`).
        renderedDOM.insertBefore(style.cloneNode(true), renderedDOM.firstChild);
    }
    else if (!!template) {
        // When no style is left in the template, parts will be broken as a
        // result. To fix this, we put back the style node ShadyCSS removed
        // and then tell lit to remove that node from the template.
        // There can be no style in the template in 2 cases (1) when Shady DOM
        // is in use, ShadyCSS removes all styles, (2) when native Shadow DOM
        // is in use ShadyCSS removes the style if it contains no content.
        // NOTE, ShadyCSS creates its own style so we can safely add/remove
        // `condensedStyle` here.
        content.insertBefore(condensedStyle, content.firstChild);
        const removes = new Set();
        removes.add(condensedStyle);
        removeNodesFromTemplate(template, removes);
    }
};
/**
 * Extension to the standard `render` method which supports rendering
 * to ShadowRoots when the ShadyDOM (https://github.com/webcomponents/shadydom)
 * and ShadyCSS (https://github.com/webcomponents/shadycss) polyfills are used
 * or when the webcomponentsjs
 * (https://github.com/webcomponents/webcomponentsjs) polyfill is used.
 *
 * Adds a `scopeName` option which is used to scope element DOM and stylesheets
 * when native ShadowDOM is unavailable. The `scopeName` will be added to
 * the class attribute of all rendered DOM. In addition, any style elements will
 * be automatically re-written with this `scopeName` selector and moved out
 * of the rendered DOM and into the document `<head>`.
 *
 * It is common to use this render method in conjunction with a custom element
 * which renders a shadowRoot. When this is done, typically the element's
 * `localName` should be used as the `scopeName`.
 *
 * In addition to DOM scoping, ShadyCSS also supports a basic shim for css
 * custom properties (needed only on older browsers like IE11) and a shim for
 * a deprecated feature called `@apply` that supports applying a set of css
 * custom properties to a given location.
 *
 * Usage considerations:
 *
 * * Part values in `<style>` elements are only applied the first time a given
 * `scopeName` renders. Subsequent changes to parts in style elements will have
 * no effect. Because of this, parts in style elements should only be used for
 * values that will never change, for example parts that set scope-wide theme
 * values or parts which render shared style elements.
 *
 * * Note, due to a limitation of the ShadyDOM polyfill, rendering in a
 * custom element's `constructor` is not supported. Instead rendering should
 * either done asynchronously, for example at microtask timing (for example
 * `Promise.resolve()`), or be deferred until the first time the element's
 * `connectedCallback` runs.
 *
 * Usage considerations when using shimmed custom properties or `@apply`:
 *
 * * Whenever any dynamic changes are made which affect
 * css custom properties, `ShadyCSS.styleElement(element)` must be called
 * to update the element. There are two cases when this is needed:
 * (1) the element is connected to a new parent, (2) a class is added to the
 * element that causes it to match different custom properties.
 * To address the first case when rendering a custom element, `styleElement`
 * should be called in the element's `connectedCallback`.
 *
 * * Shimmed custom properties may only be defined either for an entire
 * shadowRoot (for example, in a `:host` rule) or via a rule that directly
 * matches an element with a shadowRoot. In other words, instead of flowing from
 * parent to child as do native css custom properties, shimmed custom properties
 * flow only from shadowRoots to nested shadowRoots.
 *
 * * When using `@apply` mixing css shorthand property names with
 * non-shorthand names (for example `border` and `border-width`) is not
 * supported.
 */
const render = (result, container, options) => {
    if (!options || typeof options !== 'object' || !options.scopeName) {
        throw new Error('The `scopeName` option is required.');
    }
    const scopeName = options.scopeName;
    const hasRendered = parts.has(container);
    const needsScoping = compatibleShadyCSSVersion &&
        container.nodeType === 11 /* Node.DOCUMENT_FRAGMENT_NODE */ &&
        !!container.host;
    // Handle first render to a scope specially...
    const firstScopeRender = needsScoping && !shadyRenderSet.has(scopeName);
    // On first scope render, render into a fragment; this cannot be a single
    // fragment that is reused since nested renders can occur synchronously.
    const renderContainer = firstScopeRender ? document.createDocumentFragment() : container;
    render$1(result, renderContainer, Object.assign({ templateFactory: shadyTemplateFactory(scopeName) }, options));
    // When performing first scope render,
    // (1) We've rendered into a fragment so that there's a chance to
    // `prepareTemplateStyles` before sub-elements hit the DOM
    // (which might cause them to render based on a common pattern of
    // rendering in a custom element's `connectedCallback`);
    // (2) Scope the template with ShadyCSS one time only for this scope.
    // (3) Render the fragment into the container and make sure the
    // container knows its `part` is the one we just rendered. This ensures
    // DOM will be re-used on subsequent renders.
    if (firstScopeRender) {
        const part = parts.get(renderContainer);
        parts.delete(renderContainer);
        // ShadyCSS might have style sheets (e.g. from `prepareAdoptedCssText`)
        // that should apply to `renderContainer` even if the rendered value is
        // not a TemplateInstance. However, it will only insert scoped styles
        // into the document if `prepareTemplateStyles` has already been called
        // for the given scope name.
        const template = part.value instanceof TemplateInstance ?
            part.value.template :
            undefined;
        prepareTemplateStyles(scopeName, renderContainer, template);
        removeNodes(container, container.firstChild);
        container.appendChild(renderContainer);
        parts.set(container, part);
    }
    // After elements have hit the DOM, update styling if this is the
    // initial render to this container.
    // This is needed whenever dynamic changes are made so it would be
    // safest to do every render; however, this would regress performance
    // so we leave it up to the user to call `ShadyCSS.styleElement`
    // for dynamic changes.
    if (!hasRendered && needsScoping) {
        window.ShadyCSS.styleElement(container.host);
    }
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
var _a;
/**
 * Use this module if you want to create your own base class extending
 * [[UpdatingElement]].
 * @packageDocumentation
 */
/*
 * When using Closure Compiler, JSCompiler_renameProperty(property, object) is
 * replaced at compile time by the munged name for object[property]. We cannot
 * alias this function, so we have to use a small shim that has the same
 * behavior when not compiling.
 */
window.JSCompiler_renameProperty =
    (prop, _obj) => prop;
const defaultConverter = {
    toAttribute(value, type) {
        switch (type) {
            case Boolean:
                return value ? '' : null;
            case Object:
            case Array:
                // if the value is `null` or `undefined` pass this through
                // to allow removing/no change behavior.
                return value == null ? value : JSON.stringify(value);
        }
        return value;
    },
    fromAttribute(value, type) {
        switch (type) {
            case Boolean:
                return value !== null;
            case Number:
                return value === null ? null : Number(value);
            case Object:
            case Array:
                // Type assert to adhere to Bazel's "must type assert JSON parse" rule.
                return JSON.parse(value);
        }
        return value;
    }
};
/**
 * Change function that returns true if `value` is different from `oldValue`.
 * This method is used as the default for a property's `hasChanged` function.
 */
const notEqual = (value, old) => {
    // This ensures (old==NaN, value==NaN) always returns false
    return old !== value && (old === old || value === value);
};
const defaultPropertyDeclaration = {
    attribute: true,
    type: String,
    converter: defaultConverter,
    reflect: false,
    hasChanged: notEqual
};
const STATE_HAS_UPDATED = 1;
const STATE_UPDATE_REQUESTED = 1 << 2;
const STATE_IS_REFLECTING_TO_ATTRIBUTE = 1 << 3;
const STATE_IS_REFLECTING_TO_PROPERTY = 1 << 4;
/**
 * The Closure JS Compiler doesn't currently have good support for static
 * property semantics where "this" is dynamic (e.g.
 * https://github.com/google/closure-compiler/issues/3177 and others) so we use
 * this hack to bypass any rewriting by the compiler.
 */
const finalized = 'finalized';
/**
 * Base element class which manages element properties and attributes. When
 * properties change, the `update` method is asynchronously called. This method
 * should be supplied by subclassers to render updates as desired.
 * @noInheritDoc
 */
class UpdatingElement extends HTMLElement {
    constructor() {
        super();
        this.initialize();
    }
    /**
     * Returns a list of attributes corresponding to the registered properties.
     * @nocollapse
     */
    static get observedAttributes() {
        // note: piggy backing on this to ensure we're finalized.
        this.finalize();
        const attributes = [];
        // Use forEach so this works even if for/of loops are compiled to for loops
        // expecting arrays
        this._classProperties.forEach((v, p) => {
            const attr = this._attributeNameForProperty(p, v);
            if (attr !== undefined) {
                this._attributeToPropertyMap.set(attr, p);
                attributes.push(attr);
            }
        });
        return attributes;
    }
    /**
     * Ensures the private `_classProperties` property metadata is created.
     * In addition to `finalize` this is also called in `createProperty` to
     * ensure the `@property` decorator can add property metadata.
     */
    /** @nocollapse */
    static _ensureClassProperties() {
        // ensure private storage for property declarations.
        if (!this.hasOwnProperty(JSCompiler_renameProperty('_classProperties', this))) {
            this._classProperties = new Map();
            // NOTE: Workaround IE11 not supporting Map constructor argument.
            const superProperties = Object.getPrototypeOf(this)._classProperties;
            if (superProperties !== undefined) {
                superProperties.forEach((v, k) => this._classProperties.set(k, v));
            }
        }
    }
    /**
     * Creates a property accessor on the element prototype if one does not exist
     * and stores a PropertyDeclaration for the property with the given options.
     * The property setter calls the property's `hasChanged` property option
     * or uses a strict identity check to determine whether or not to request
     * an update.
     *
     * This method may be overridden to customize properties; however,
     * when doing so, it's important to call `super.createProperty` to ensure
     * the property is setup correctly. This method calls
     * `getPropertyDescriptor` internally to get a descriptor to install.
     * To customize what properties do when they are get or set, override
     * `getPropertyDescriptor`. To customize the options for a property,
     * implement `createProperty` like this:
     *
     * static createProperty(name, options) {
     *   options = Object.assign(options, {myOption: true});
     *   super.createProperty(name, options);
     * }
     *
     * @nocollapse
     */
    static createProperty(name, options = defaultPropertyDeclaration) {
        // Note, since this can be called by the `@property` decorator which
        // is called before `finalize`, we ensure storage exists for property
        // metadata.
        this._ensureClassProperties();
        this._classProperties.set(name, options);
        // Do not generate an accessor if the prototype already has one, since
        // it would be lost otherwise and that would never be the user's intention;
        // Instead, we expect users to call `requestUpdate` themselves from
        // user-defined accessors. Note that if the super has an accessor we will
        // still overwrite it
        if (options.noAccessor || this.prototype.hasOwnProperty(name)) {
            return;
        }
        const key = typeof name === 'symbol' ? Symbol() : `__${name}`;
        const descriptor = this.getPropertyDescriptor(name, key, options);
        if (descriptor !== undefined) {
            Object.defineProperty(this.prototype, name, descriptor);
        }
    }
    /**
     * Returns a property descriptor to be defined on the given named property.
     * If no descriptor is returned, the property will not become an accessor.
     * For example,
     *
     *   class MyElement extends LitElement {
     *     static getPropertyDescriptor(name, key, options) {
     *       const defaultDescriptor =
     *           super.getPropertyDescriptor(name, key, options);
     *       const setter = defaultDescriptor.set;
     *       return {
     *         get: defaultDescriptor.get,
     *         set(value) {
     *           setter.call(this, value);
     *           // custom action.
     *         },
     *         configurable: true,
     *         enumerable: true
     *       }
     *     }
     *   }
     *
     * @nocollapse
     */
    static getPropertyDescriptor(name, key, options) {
        return {
            // tslint:disable-next-line:no-any no symbol in index
            get() {
                return this[key];
            },
            set(value) {
                const oldValue = this[name];
                this[key] = value;
                this
                    .requestUpdateInternal(name, oldValue, options);
            },
            configurable: true,
            enumerable: true
        };
    }
    /**
     * Returns the property options associated with the given property.
     * These options are defined with a PropertyDeclaration via the `properties`
     * object or the `@property` decorator and are registered in
     * `createProperty(...)`.
     *
     * Note, this method should be considered "final" and not overridden. To
     * customize the options for a given property, override `createProperty`.
     *
     * @nocollapse
     * @final
     */
    static getPropertyOptions(name) {
        return this._classProperties && this._classProperties.get(name) ||
            defaultPropertyDeclaration;
    }
    /**
     * Creates property accessors for registered properties and ensures
     * any superclasses are also finalized.
     * @nocollapse
     */
    static finalize() {
        // finalize any superclasses
        const superCtor = Object.getPrototypeOf(this);
        if (!superCtor.hasOwnProperty(finalized)) {
            superCtor.finalize();
        }
        this[finalized] = true;
        this._ensureClassProperties();
        // initialize Map populated in observedAttributes
        this._attributeToPropertyMap = new Map();
        // make any properties
        // Note, only process "own" properties since this element will inherit
        // any properties defined on the superClass, and finalization ensures
        // the entire prototype chain is finalized.
        if (this.hasOwnProperty(JSCompiler_renameProperty('properties', this))) {
            const props = this.properties;
            // support symbols in properties (IE11 does not support this)
            const propKeys = [
                ...Object.getOwnPropertyNames(props),
                ...(typeof Object.getOwnPropertySymbols === 'function') ?
                    Object.getOwnPropertySymbols(props) :
                    []
            ];
            // This for/of is ok because propKeys is an array
            for (const p of propKeys) {
                // note, use of `any` is due to TypeSript lack of support for symbol in
                // index types
                // tslint:disable-next-line:no-any no symbol in index
                this.createProperty(p, props[p]);
            }
        }
    }
    /**
     * Returns the property name for the given attribute `name`.
     * @nocollapse
     */
    static _attributeNameForProperty(name, options) {
        const attribute = options.attribute;
        return attribute === false ?
            undefined :
            (typeof attribute === 'string' ?
                attribute :
                (typeof name === 'string' ? name.toLowerCase() : undefined));
    }
    /**
     * Returns true if a property should request an update.
     * Called when a property value is set and uses the `hasChanged`
     * option for the property if present or a strict identity check.
     * @nocollapse
     */
    static _valueHasChanged(value, old, hasChanged = notEqual) {
        return hasChanged(value, old);
    }
    /**
     * Returns the property value for the given attribute value.
     * Called via the `attributeChangedCallback` and uses the property's
     * `converter` or `converter.fromAttribute` property option.
     * @nocollapse
     */
    static _propertyValueFromAttribute(value, options) {
        const type = options.type;
        const converter = options.converter || defaultConverter;
        const fromAttribute = (typeof converter === 'function' ? converter : converter.fromAttribute);
        return fromAttribute ? fromAttribute(value, type) : value;
    }
    /**
     * Returns the attribute value for the given property value. If this
     * returns undefined, the property will *not* be reflected to an attribute.
     * If this returns null, the attribute will be removed, otherwise the
     * attribute will be set to the value.
     * This uses the property's `reflect` and `type.toAttribute` property options.
     * @nocollapse
     */
    static _propertyValueToAttribute(value, options) {
        if (options.reflect === undefined) {
            return;
        }
        const type = options.type;
        const converter = options.converter;
        const toAttribute = converter && converter.toAttribute ||
            defaultConverter.toAttribute;
        return toAttribute(value, type);
    }
    /**
     * Performs element initialization. By default captures any pre-set values for
     * registered properties.
     */
    initialize() {
        this._updateState = 0;
        this._updatePromise =
            new Promise((res) => this._enableUpdatingResolver = res);
        this._changedProperties = new Map();
        this._saveInstanceProperties();
        // ensures first update will be caught by an early access of
        // `updateComplete`
        this.requestUpdateInternal();
    }
    /**
     * Fixes any properties set on the instance before upgrade time.
     * Otherwise these would shadow the accessor and break these properties.
     * The properties are stored in a Map which is played back after the
     * constructor runs. Note, on very old versions of Safari (<=9) or Chrome
     * (<=41), properties created for native platform properties like (`id` or
     * `name`) may not have default values set in the element constructor. On
     * these browsers native properties appear on instances and therefore their
     * default value will overwrite any element default (e.g. if the element sets
     * this.id = 'id' in the constructor, the 'id' will become '' since this is
     * the native platform default).
     */
    _saveInstanceProperties() {
        // Use forEach so this works even if for/of loops are compiled to for loops
        // expecting arrays
        this.constructor
            ._classProperties.forEach((_v, p) => {
            if (this.hasOwnProperty(p)) {
                const value = this[p];
                delete this[p];
                if (!this._instanceProperties) {
                    this._instanceProperties = new Map();
                }
                this._instanceProperties.set(p, value);
            }
        });
    }
    /**
     * Applies previously saved instance properties.
     */
    _applyInstanceProperties() {
        // Use forEach so this works even if for/of loops are compiled to for loops
        // expecting arrays
        // tslint:disable-next-line:no-any
        this._instanceProperties.forEach((v, p) => this[p] = v);
        this._instanceProperties = undefined;
    }
    connectedCallback() {
        // Ensure first connection completes an update. Updates cannot complete
        // before connection.
        this.enableUpdating();
    }
    enableUpdating() {
        if (this._enableUpdatingResolver !== undefined) {
            this._enableUpdatingResolver();
            this._enableUpdatingResolver = undefined;
        }
    }
    /**
     * Allows for `super.disconnectedCallback()` in extensions while
     * reserving the possibility of making non-breaking feature additions
     * when disconnecting at some point in the future.
     */
    disconnectedCallback() {
    }
    /**
     * Synchronizes property values when attributes change.
     */
    attributeChangedCallback(name, old, value) {
        if (old !== value) {
            this._attributeToProperty(name, value);
        }
    }
    _propertyToAttribute(name, value, options = defaultPropertyDeclaration) {
        const ctor = this.constructor;
        const attr = ctor._attributeNameForProperty(name, options);
        if (attr !== undefined) {
            const attrValue = ctor._propertyValueToAttribute(value, options);
            // an undefined value does not change the attribute.
            if (attrValue === undefined) {
                return;
            }
            // Track if the property is being reflected to avoid
            // setting the property again via `attributeChangedCallback`. Note:
            // 1. this takes advantage of the fact that the callback is synchronous.
            // 2. will behave incorrectly if multiple attributes are in the reaction
            // stack at time of calling. However, since we process attributes
            // in `update` this should not be possible (or an extreme corner case
            // that we'd like to discover).
            // mark state reflecting
            this._updateState = this._updateState | STATE_IS_REFLECTING_TO_ATTRIBUTE;
            if (attrValue == null) {
                this.removeAttribute(attr);
            }
            else {
                this.setAttribute(attr, attrValue);
            }
            // mark state not reflecting
            this._updateState = this._updateState & ~STATE_IS_REFLECTING_TO_ATTRIBUTE;
        }
    }
    _attributeToProperty(name, value) {
        // Use tracking info to avoid deserializing attribute value if it was
        // just set from a property setter.
        if (this._updateState & STATE_IS_REFLECTING_TO_ATTRIBUTE) {
            return;
        }
        const ctor = this.constructor;
        // Note, hint this as an `AttributeMap` so closure clearly understands
        // the type; it has issues with tracking types through statics
        // tslint:disable-next-line:no-unnecessary-type-assertion
        const propName = ctor._attributeToPropertyMap.get(name);
        if (propName !== undefined) {
            const options = ctor.getPropertyOptions(propName);
            // mark state reflecting
            this._updateState = this._updateState | STATE_IS_REFLECTING_TO_PROPERTY;
            this[propName] =
                // tslint:disable-next-line:no-any
                ctor._propertyValueFromAttribute(value, options);
            // mark state not reflecting
            this._updateState = this._updateState & ~STATE_IS_REFLECTING_TO_PROPERTY;
        }
    }
    /**
     * This protected version of `requestUpdate` does not access or return the
     * `updateComplete` promise. This promise can be overridden and is therefore
     * not free to access.
     */
    requestUpdateInternal(name, oldValue, options) {
        let shouldRequestUpdate = true;
        // If we have a property key, perform property update steps.
        if (name !== undefined) {
            const ctor = this.constructor;
            options = options || ctor.getPropertyOptions(name);
            if (ctor._valueHasChanged(this[name], oldValue, options.hasChanged)) {
                if (!this._changedProperties.has(name)) {
                    this._changedProperties.set(name, oldValue);
                }
                // Add to reflecting properties set.
                // Note, it's important that every change has a chance to add the
                // property to `_reflectingProperties`. This ensures setting
                // attribute + property reflects correctly.
                if (options.reflect === true &&
                    !(this._updateState & STATE_IS_REFLECTING_TO_PROPERTY)) {
                    if (this._reflectingProperties === undefined) {
                        this._reflectingProperties = new Map();
                    }
                    this._reflectingProperties.set(name, options);
                }
            }
            else {
                // Abort the request if the property should not be considered changed.
                shouldRequestUpdate = false;
            }
        }
        if (!this._hasRequestedUpdate && shouldRequestUpdate) {
            this._updatePromise = this._enqueueUpdate();
        }
    }
    /**
     * Requests an update which is processed asynchronously. This should
     * be called when an element should update based on some state not triggered
     * by setting a property. In this case, pass no arguments. It should also be
     * called when manually implementing a property setter. In this case, pass the
     * property `name` and `oldValue` to ensure that any configured property
     * options are honored. Returns the `updateComplete` Promise which is resolved
     * when the update completes.
     *
     * @param name {PropertyKey} (optional) name of requesting property
     * @param oldValue {any} (optional) old value of requesting property
     * @returns {Promise} A Promise that is resolved when the update completes.
     */
    requestUpdate(name, oldValue) {
        this.requestUpdateInternal(name, oldValue);
        return this.updateComplete;
    }
    /**
     * Sets up the element to asynchronously update.
     */
    async _enqueueUpdate() {
        this._updateState = this._updateState | STATE_UPDATE_REQUESTED;
        try {
            // Ensure any previous update has resolved before updating.
            // This `await` also ensures that property changes are batched.
            await this._updatePromise;
        }
        catch (e) {
            // Ignore any previous errors. We only care that the previous cycle is
            // done. Any error should have been handled in the previous update.
        }
        const result = this.performUpdate();
        // If `performUpdate` returns a Promise, we await it. This is done to
        // enable coordinating updates with a scheduler. Note, the result is
        // checked to avoid delaying an additional microtask unless we need to.
        if (result != null) {
            await result;
        }
        return !this._hasRequestedUpdate;
    }
    get _hasRequestedUpdate() {
        return (this._updateState & STATE_UPDATE_REQUESTED);
    }
    get hasUpdated() {
        return (this._updateState & STATE_HAS_UPDATED);
    }
    /**
     * Performs an element update. Note, if an exception is thrown during the
     * update, `firstUpdated` and `updated` will not be called.
     *
     * You can override this method to change the timing of updates. If this
     * method is overridden, `super.performUpdate()` must be called.
     *
     * For instance, to schedule updates to occur just before the next frame:
     *
     * ```
     * protected async performUpdate(): Promise<unknown> {
     *   await new Promise((resolve) => requestAnimationFrame(() => resolve()));
     *   super.performUpdate();
     * }
     * ```
     */
    performUpdate() {
        // Abort any update if one is not pending when this is called.
        // This can happen if `performUpdate` is called early to "flush"
        // the update.
        if (!this._hasRequestedUpdate) {
            return;
        }
        // Mixin instance properties once, if they exist.
        if (this._instanceProperties) {
            this._applyInstanceProperties();
        }
        let shouldUpdate = false;
        const changedProperties = this._changedProperties;
        try {
            shouldUpdate = this.shouldUpdate(changedProperties);
            if (shouldUpdate) {
                this.update(changedProperties);
            }
            else {
                this._markUpdated();
            }
        }
        catch (e) {
            // Prevent `firstUpdated` and `updated` from running when there's an
            // update exception.
            shouldUpdate = false;
            // Ensure element can accept additional updates after an exception.
            this._markUpdated();
            throw e;
        }
        if (shouldUpdate) {
            if (!(this._updateState & STATE_HAS_UPDATED)) {
                this._updateState = this._updateState | STATE_HAS_UPDATED;
                this.firstUpdated(changedProperties);
            }
            this.updated(changedProperties);
        }
    }
    _markUpdated() {
        this._changedProperties = new Map();
        this._updateState = this._updateState & ~STATE_UPDATE_REQUESTED;
    }
    /**
     * Returns a Promise that resolves when the element has completed updating.
     * The Promise value is a boolean that is `true` if the element completed the
     * update without triggering another update. The Promise result is `false` if
     * a property was set inside `updated()`. If the Promise is rejected, an
     * exception was thrown during the update.
     *
     * To await additional asynchronous work, override the `_getUpdateComplete`
     * method. For example, it is sometimes useful to await a rendered element
     * before fulfilling this Promise. To do this, first await
     * `super._getUpdateComplete()`, then any subsequent state.
     *
     * @returns {Promise} The Promise returns a boolean that indicates if the
     * update resolved without triggering another update.
     */
    get updateComplete() {
        return this._getUpdateComplete();
    }
    /**
     * Override point for the `updateComplete` promise.
     *
     * It is not safe to override the `updateComplete` getter directly due to a
     * limitation in TypeScript which means it is not possible to call a
     * superclass getter (e.g. `super.updateComplete.then(...)`) when the target
     * language is ES5 (https://github.com/microsoft/TypeScript/issues/338).
     * This method should be overridden instead. For example:
     *
     *   class MyElement extends LitElement {
     *     async _getUpdateComplete() {
     *       await super._getUpdateComplete();
     *       await this._myChild.updateComplete;
     *     }
     *   }
     * @deprecated Override `getUpdateComplete()` instead for forward
     *     compatibility with `lit-element` 3.0 / `@lit/reactive-element`.
     */
    _getUpdateComplete() {
        return this.getUpdateComplete();
    }
    /**
     * Override point for the `updateComplete` promise.
     *
     * It is not safe to override the `updateComplete` getter directly due to a
     * limitation in TypeScript which means it is not possible to call a
     * superclass getter (e.g. `super.updateComplete.then(...)`) when the target
     * language is ES5 (https://github.com/microsoft/TypeScript/issues/338).
     * This method should be overridden instead. For example:
     *
     *   class MyElement extends LitElement {
     *     async getUpdateComplete() {
     *       await super.getUpdateComplete();
     *       await this._myChild.updateComplete;
     *     }
     *   }
     */
    getUpdateComplete() {
        return this._updatePromise;
    }
    /**
     * Controls whether or not `update` should be called when the element requests
     * an update. By default, this method always returns `true`, but this can be
     * customized to control when to update.
     *
     * @param _changedProperties Map of changed properties with old values
     */
    shouldUpdate(_changedProperties) {
        return true;
    }
    /**
     * Updates the element. This method reflects property values to attributes.
     * It can be overridden to render and keep updated element DOM.
     * Setting properties inside this method will *not* trigger
     * another update.
     *
     * @param _changedProperties Map of changed properties with old values
     */
    update(_changedProperties) {
        if (this._reflectingProperties !== undefined &&
            this._reflectingProperties.size > 0) {
            // Use forEach so this works even if for/of loops are compiled to for
            // loops expecting arrays
            this._reflectingProperties.forEach((v, k) => this._propertyToAttribute(k, this[k], v));
            this._reflectingProperties = undefined;
        }
        this._markUpdated();
    }
    /**
     * Invoked whenever the element is updated. Implement to perform
     * post-updating tasks via DOM APIs, for example, focusing an element.
     *
     * Setting properties inside this method will trigger the element to update
     * again after this update cycle completes.
     *
     * @param _changedProperties Map of changed properties with old values
     */
    updated(_changedProperties) {
    }
    /**
     * Invoked when the element is first updated. Implement to perform one time
     * work on the element after update.
     *
     * Setting properties inside this method will trigger the element to update
     * again after this update cycle completes.
     *
     * @param _changedProperties Map of changed properties with old values
     */
    firstUpdated(_changedProperties) {
    }
}
_a = finalized;
/**
 * Marks class as having finished creating properties.
 */
UpdatingElement[_a] = true;

/**
@license
Copyright (c) 2019 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at
http://polymer.github.io/LICENSE.txt The complete set of authors may be found at
http://polymer.github.io/AUTHORS.txt The complete set of contributors may be
found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by Google as
part of the polymer project is also subject to an additional IP rights grant
found at http://polymer.github.io/PATENTS.txt
*/
/**
 * Whether the current browser supports `adoptedStyleSheets`.
 */
const supportsAdoptingStyleSheets = (window.ShadowRoot) &&
    (window.ShadyCSS === undefined || window.ShadyCSS.nativeShadow) &&
    ('adoptedStyleSheets' in Document.prototype) &&
    ('replace' in CSSStyleSheet.prototype);
const constructionToken = Symbol();
class CSSResult {
    constructor(cssText, safeToken) {
        if (safeToken !== constructionToken) {
            throw new Error('CSSResult is not constructable. Use `unsafeCSS` or `css` instead.');
        }
        this.cssText = cssText;
    }
    // Note, this is a getter so that it's lazy. In practice, this means
    // stylesheets are not created until the first element instance is made.
    get styleSheet() {
        if (this._styleSheet === undefined) {
            // Note, if `supportsAdoptingStyleSheets` is true then we assume
            // CSSStyleSheet is constructable.
            if (supportsAdoptingStyleSheets) {
                this._styleSheet = new CSSStyleSheet();
                this._styleSheet.replaceSync(this.cssText);
            }
            else {
                this._styleSheet = null;
            }
        }
        return this._styleSheet;
    }
    toString() {
        return this.cssText;
    }
}
/**
 * Wrap a value for interpolation in a [[`css`]] tagged template literal.
 *
 * This is unsafe because untrusted CSS text can be used to phone home
 * or exfiltrate data to an attacker controlled site. Take care to only use
 * this with trusted input.
 */
const unsafeCSS = (value) => {
    return new CSSResult(String(value), constructionToken);
};
const textFromCSSResult = (value) => {
    if (value instanceof CSSResult) {
        return value.cssText;
    }
    else if (typeof value === 'number') {
        return value;
    }
    else {
        throw new Error(`Value passed to 'css' function must be a 'css' function result: ${value}. Use 'unsafeCSS' to pass non-literal values, but
            take care to ensure page security.`);
    }
};
/**
 * Template tag which which can be used with LitElement's [[LitElement.styles |
 * `styles`]] property to set element styles. For security reasons, only literal
 * string values may be used. To incorporate non-literal values [[`unsafeCSS`]]
 * may be used inside a template string part.
 */
const css = (strings, ...values) => {
    const cssText = values.reduce((acc, v, idx) => acc + textFromCSSResult(v) + strings[idx + 1], strings[0]);
    return new CSSResult(cssText, constructionToken);
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
// IMPORTANT: do not change the property name or the assignment expression.
// This line will be used in regexes to search for LitElement usage.
// TODO(justinfagnani): inject version number at build time
(window['litElementVersions'] || (window['litElementVersions'] = []))
    .push('2.5.1');
/**
 * Sentinal value used to avoid calling lit-html's render function when
 * subclasses do not implement `render`
 */
const renderNotImplemented = {};
/**
 * Base element class that manages element properties and attributes, and
 * renders a lit-html template.
 *
 * To define a component, subclass `LitElement` and implement a
 * `render` method to provide the component's template. Define properties
 * using the [[`properties`]] property or the [[`property`]] decorator.
 */
class LitElement extends UpdatingElement {
    /**
     * Return the array of styles to apply to the element.
     * Override this method to integrate into a style management system.
     *
     * @nocollapse
     */
    static getStyles() {
        return this.styles;
    }
    /** @nocollapse */
    static _getUniqueStyles() {
        // Only gather styles once per class
        if (this.hasOwnProperty(JSCompiler_renameProperty('_styles', this))) {
            return;
        }
        // Take care not to call `this.getStyles()` multiple times since this
        // generates new CSSResults each time.
        // TODO(sorvell): Since we do not cache CSSResults by input, any
        // shared styles will generate new stylesheet objects, which is wasteful.
        // This should be addressed when a browser ships constructable
        // stylesheets.
        const userStyles = this.getStyles();
        if (Array.isArray(userStyles)) {
            // De-duplicate styles preserving the _last_ instance in the set.
            // This is a performance optimization to avoid duplicated styles that can
            // occur especially when composing via subclassing.
            // The last item is kept to try to preserve the cascade order with the
            // assumption that it's most important that last added styles override
            // previous styles.
            const addStyles = (styles, set) => styles.reduceRight((set, s) => 
            // Note: On IE set.add() does not return the set
            Array.isArray(s) ? addStyles(s, set) : (set.add(s), set), set);
            // Array.from does not work on Set in IE, otherwise return
            // Array.from(addStyles(userStyles, new Set<CSSResult>())).reverse()
            const set = addStyles(userStyles, new Set());
            const styles = [];
            set.forEach((v) => styles.unshift(v));
            this._styles = styles;
        }
        else {
            this._styles = userStyles === undefined ? [] : [userStyles];
        }
        // Ensure that there are no invalid CSSStyleSheet instances here. They are
        // invalid in two conditions.
        // (1) the sheet is non-constructible (`sheet` of a HTMLStyleElement), but
        //     this is impossible to check except via .replaceSync or use
        // (2) the ShadyCSS polyfill is enabled (:. supportsAdoptingStyleSheets is
        //     false)
        this._styles = this._styles.map((s) => {
            if (s instanceof CSSStyleSheet && !supportsAdoptingStyleSheets) {
                // Flatten the cssText from the passed constructible stylesheet (or
                // undetectable non-constructible stylesheet). The user might have
                // expected to update their stylesheets over time, but the alternative
                // is a crash.
                const cssText = Array.prototype.slice.call(s.cssRules)
                    .reduce((css, rule) => css + rule.cssText, '');
                return unsafeCSS(cssText);
            }
            return s;
        });
    }
    /**
     * Performs element initialization. By default this calls
     * [[`createRenderRoot`]] to create the element [[`renderRoot`]] node and
     * captures any pre-set values for registered properties.
     */
    initialize() {
        super.initialize();
        this.constructor._getUniqueStyles();
        this.renderRoot = this.createRenderRoot();
        // Note, if renderRoot is not a shadowRoot, styles would/could apply to the
        // element's getRootNode(). While this could be done, we're choosing not to
        // support this now since it would require different logic around de-duping.
        if (window.ShadowRoot && this.renderRoot instanceof window.ShadowRoot) {
            this.adoptStyles();
        }
    }
    /**
     * Returns the node into which the element should render and by default
     * creates and returns an open shadowRoot. Implement to customize where the
     * element's DOM is rendered. For example, to render into the element's
     * childNodes, return `this`.
     * @returns {Element|DocumentFragment} Returns a node into which to render.
     */
    createRenderRoot() {
        return this.attachShadow(this.constructor.shadowRootOptions);
    }
    /**
     * Applies styling to the element shadowRoot using the [[`styles`]]
     * property. Styling will apply using `shadowRoot.adoptedStyleSheets` where
     * available and will fallback otherwise. When Shadow DOM is polyfilled,
     * ShadyCSS scopes styles and adds them to the document. When Shadow DOM
     * is available but `adoptedStyleSheets` is not, styles are appended to the
     * end of the `shadowRoot` to [mimic spec
     * behavior](https://wicg.github.io/construct-stylesheets/#using-constructed-stylesheets).
     */
    adoptStyles() {
        const styles = this.constructor._styles;
        if (styles.length === 0) {
            return;
        }
        // There are three separate cases here based on Shadow DOM support.
        // (1) shadowRoot polyfilled: use ShadyCSS
        // (2) shadowRoot.adoptedStyleSheets available: use it
        // (3) shadowRoot.adoptedStyleSheets polyfilled: append styles after
        // rendering
        if (window.ShadyCSS !== undefined && !window.ShadyCSS.nativeShadow) {
            window.ShadyCSS.ScopingShim.prepareAdoptedCssText(styles.map((s) => s.cssText), this.localName);
        }
        else if (supportsAdoptingStyleSheets) {
            this.renderRoot.adoptedStyleSheets =
                styles.map((s) => s instanceof CSSStyleSheet ? s : s.styleSheet);
        }
        else {
            // This must be done after rendering so the actual style insertion is done
            // in `update`.
            this._needsShimAdoptedStyleSheets = true;
        }
    }
    connectedCallback() {
        super.connectedCallback();
        // Note, first update/render handles styleElement so we only call this if
        // connected after first update.
        if (this.hasUpdated && window.ShadyCSS !== undefined) {
            window.ShadyCSS.styleElement(this);
        }
    }
    /**
     * Updates the element. This method reflects property values to attributes
     * and calls `render` to render DOM via lit-html. Setting properties inside
     * this method will *not* trigger another update.
     * @param _changedProperties Map of changed properties with old values
     */
    update(changedProperties) {
        // Setting properties in `render` should not trigger an update. Since
        // updates are allowed after super.update, it's important to call `render`
        // before that.
        const templateResult = this.render();
        super.update(changedProperties);
        // If render is not implemented by the component, don't call lit-html render
        if (templateResult !== renderNotImplemented) {
            this.constructor
                .render(templateResult, this.renderRoot, { scopeName: this.localName, eventContext: this });
        }
        // When native Shadow DOM is used but adoptedStyles are not supported,
        // insert styling after rendering to ensure adoptedStyles have highest
        // priority.
        if (this._needsShimAdoptedStyleSheets) {
            this._needsShimAdoptedStyleSheets = false;
            this.constructor._styles.forEach((s) => {
                const style = document.createElement('style');
                style.textContent = s.cssText;
                this.renderRoot.appendChild(style);
            });
        }
    }
    /**
     * Invoked on each update to perform rendering tasks. This method may return
     * any value renderable by lit-html's `NodePart` - typically a
     * `TemplateResult`. Setting properties inside this method will *not* trigger
     * the element to update.
     */
    render() {
        return renderNotImplemented;
    }
}
/**
 * Ensure this class is marked as `finalized` as an optimization ensuring
 * it will not needlessly try to `finalize`.
 *
 * Note this property name is a string to prevent breaking Closure JS Compiler
 * optimizations. See updating-element.ts for more information.
 */
LitElement['finalized'] = true;
/**
 * Reference to the underlying library method used to render the element's
 * DOM. By default, points to the `render` method from lit-html's shady-render
 * module.
 *
 * **Most users will never need to touch this property.**
 *
 * This  property should not be confused with the `render` instance method,
 * which should be overridden to define a template for the element.
 *
 * Advanced users creating a new base class based on LitElement can override
 * this property to point to a custom render method with a signature that
 * matches [shady-render's `render`
 * method](https://lit-html.polymer-project.org/api/modules/shady_render.html#render).
 *
 * @nocollapse
 */
LitElement.render = render;
/** @nocollapse */
LitElement.shadowRootOptions = { mode: 'open' };

/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
// IE11 doesn't support classList on SVG elements, so we emulate it with a Set
class ClassList {
    constructor(element) {
        this.classes = new Set();
        this.changed = false;
        this.element = element;
        const classList = (element.getAttribute('class') || '').split(/\s+/);
        for (const cls of classList) {
            this.classes.add(cls);
        }
    }
    add(cls) {
        this.classes.add(cls);
        this.changed = true;
    }
    remove(cls) {
        this.classes.delete(cls);
        this.changed = true;
    }
    commit() {
        if (this.changed) {
            let classString = '';
            this.classes.forEach((cls) => classString += cls + ' ');
            this.element.setAttribute('class', classString);
        }
    }
}
/**
 * Stores the ClassInfo object applied to a given AttributePart.
 * Used to unset existing values when a new ClassInfo object is applied.
 */
const previousClassesCache = new WeakMap();
/**
 * A directive that applies CSS classes. This must be used in the `class`
 * attribute and must be the only part used in the attribute. It takes each
 * property in the `classInfo` argument and adds the property name to the
 * element's `class` if the property value is truthy; if the property value is
 * falsey, the property name is removed from the element's `class`. For example
 * `{foo: bar}` applies the class `foo` if the value of `bar` is truthy.
 * @param classInfo {ClassInfo}
 */
const classMap = directive((classInfo) => (part) => {
    if (!(part instanceof AttributePart) || (part instanceof PropertyPart) ||
        part.committer.name !== 'class' || part.committer.parts.length > 1) {
        throw new Error('The `classMap` directive must be used in the `class` attribute ' +
            'and must be the only part in the attribute.');
    }
    const { committer } = part;
    const { element } = committer;
    let previousClasses = previousClassesCache.get(part);
    if (previousClasses === undefined) {
        // Write static classes once
        // Use setAttribute() because className isn't a string on SVG elements
        element.setAttribute('class', committer.strings.join(' '));
        previousClassesCache.set(part, previousClasses = new Set());
    }
    const classList = (element.classList || new ClassList(element));
    // Remove old classes that no longer apply
    // We use forEach() instead of for-of so that re don't require down-level
    // iteration.
    previousClasses.forEach((name) => {
        if (!(name in classInfo)) {
            classList.remove(name);
            previousClasses.delete(name);
        }
    });
    // Add or remove classes based on their classMap value
    for (const name in classInfo) {
        const value = classInfo[name];
        if (value != previousClasses.has(name)) {
            // We explicitly want a loose truthy check of `value` because it seems
            // more convenient that '' and 0 are skipped.
            if (value) {
                classList.add(name);
                previousClasses.add(name);
            }
            else {
                classList.remove(name);
                previousClasses.delete(name);
            }
        }
    }
    if (typeof classList.commit === 'function') {
        classList.commit();
    }
});

/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * Stores the StyleInfo object applied to a given AttributePart.
 * Used to unset existing values when a new StyleInfo object is applied.
 */
const previousStylePropertyCache = new WeakMap();
/**
 * A directive that applies CSS properties to an element.
 *
 * `styleMap` can only be used in the `style` attribute and must be the only
 * expression in the attribute. It takes the property names in the `styleInfo`
 * object and adds the property values as CSS properties. Property names with
 * dashes (`-`) are assumed to be valid CSS property names and set on the
 * element's style object using `setProperty()`. Names without dashes are
 * assumed to be camelCased JavaScript property names and set on the element's
 * style object using property assignment, allowing the style object to
 * translate JavaScript-style names to CSS property names.
 *
 * For example `styleMap({backgroundColor: 'red', 'border-top': '5px', '--size':
 * '0'})` sets the `background-color`, `border-top` and `--size` properties.
 *
 * @param styleInfo {StyleInfo}
 */
const styleMap = directive((styleInfo) => (part) => {
    if (!(part instanceof AttributePart) || (part instanceof PropertyPart) ||
        part.committer.name !== 'style' || part.committer.parts.length > 1) {
        throw new Error('The `styleMap` directive must be used in the style attribute ' +
            'and must be the only part in the attribute.');
    }
    const { committer } = part;
    const { style } = committer.element;
    let previousStyleProperties = previousStylePropertyCache.get(part);
    if (previousStyleProperties === undefined) {
        // Write static styles once
        style.cssText = committer.strings.join(' ');
        previousStylePropertyCache.set(part, previousStyleProperties = new Set());
    }
    // Remove old properties that no longer exist in styleInfo
    // We use forEach() instead of for-of so that re don't require down-level
    // iteration.
    previousStyleProperties.forEach((name) => {
        if (!(name in styleInfo)) {
            previousStyleProperties.delete(name);
            if (name.indexOf('-') === -1) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                style[name] = null;
            }
            else {
                style.removeProperty(name);
            }
        }
    });
    // Add or update properties
    for (const name in styleInfo) {
        previousStyleProperties.add(name);
        if (name.indexOf('-') === -1) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            style[name] = styleInfo[name];
        }
        else {
            style.setProperty(name, styleInfo[name]);
        }
    }
});

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
// For each part, remember the value that was last rendered to the part by the
// unsafeSVG directive, and the DocumentFragment that was last set as a value.
// The DocumentFragment is used as a unique key to check if the last value
// rendered to the part was with unsafeSVG. If not, we'll always re-render the
// value passed to unsafeSVG.
const previousValues$1 = new WeakMap();
const isIe = window.navigator.userAgent.indexOf('Trident/') > 0;
/**
 * Renders the result as SVG, rather than text.
 *
 * Note, this is unsafe to use with any user-provided input that hasn't been
 * sanitized or escaped, as it may lead to cross-site-scripting
 * vulnerabilities.
 */
const unsafeSVG = directive((value) => (part) => {
    if (!(part instanceof NodePart)) {
        throw new Error('unsafeSVG can only be used in text bindings');
    }
    const previousValue = previousValues$1.get(part);
    if (previousValue !== undefined && isPrimitive(value) &&
        value === previousValue.value && part.value === previousValue.fragment) {
        return;
    }
    const template = document.createElement('template');
    const content = template.content;
    let svgElement;
    if (isIe) {
        // IE can't set innerHTML of an svg element. However, it also doesn't
        // support Trusted Types, so it's ok for us to use a string when setting
        // innerHTML.
        template.innerHTML = `<svg>${value}</svg>`;
        svgElement = content.firstChild;
    }
    else {
        svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        content.appendChild(svgElement);
        svgElement.innerHTML = value;
    }
    content.removeChild(svgElement);
    reparentNodes(content, svgElement.firstChild);
    const fragment = document.importNode(content, true);
    part.setValue(fragment);
    previousValues$1.set(part, { value, fragment });
});

/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const previousValues = new WeakMap();
/**
 * For AttributeParts, sets the attribute if the value is defined and removes
 * the attribute if the value is undefined.
 *
 * For other part types, this directive is a no-op.
 */
const ifDefined = directive((value) => (part) => {
    const previousValue = previousValues.get(part);
    if (value === undefined && part instanceof AttributePart) {
        // If the value is undefined, remove the attribute, but only if the value
        // was previously defined.
        if (previousValue !== undefined || !previousValues.has(part)) {
            const name = part.committer.name;
            part.committer.element.removeAttribute(name);
        }
    }
    else if (value !== previousValue) {
        part.setValue(value);
    }
    previousValues.set(part, value);
});

var __assign = (undefined && undefined.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var MS_PER_SECOND = 1e3;
var SECS_PER_MIN = 60;
var SECS_PER_HOUR = SECS_PER_MIN * 60;
var SECS_PER_DAY = SECS_PER_HOUR * 24;
var SECS_PER_WEEK = SECS_PER_DAY * 7;
function selectUnit(from, to, thresholds) {
    if (to === void 0) { to = Date.now(); }
    if (thresholds === void 0) { thresholds = {}; }
    var resolvedThresholds = __assign(__assign({}, DEFAULT_THRESHOLDS), (thresholds || {}));
    var secs = (+from - +to) / MS_PER_SECOND;
    if (Math.abs(secs) < resolvedThresholds.second) {
        return {
            value: Math.round(secs),
            unit: 'second',
        };
    }
    var mins = secs / SECS_PER_MIN;
    if (Math.abs(mins) < resolvedThresholds.minute) {
        return {
            value: Math.round(mins),
            unit: 'minute',
        };
    }
    var hours = secs / SECS_PER_HOUR;
    if (Math.abs(hours) < resolvedThresholds.hour) {
        return {
            value: Math.round(hours),
            unit: 'hour',
        };
    }
    var days = secs / SECS_PER_DAY;
    if (Math.abs(days) < resolvedThresholds.day) {
        return {
            value: Math.round(days),
            unit: 'day',
        };
    }
    var fromDate = new Date(from);
    var toDate = new Date(to);
    var years = fromDate.getFullYear() - toDate.getFullYear();
    if (Math.round(Math.abs(years)) > 0) {
        return {
            value: Math.round(years),
            unit: 'year',
        };
    }
    var months = years * 12 + fromDate.getMonth() - toDate.getMonth();
    if (Math.round(Math.abs(months)) > 0) {
        return {
            value: Math.round(months),
            unit: 'month',
        };
    }
    var weeks = secs / SECS_PER_WEEK;
    return {
        value: Math.round(weeks),
        unit: 'week',
    };
}
var DEFAULT_THRESHOLDS = {
    second: 45,
    minute: 45,
    hour: 22,
    day: 5,
};

var t,r;!function(e){e.language="language",e.system="system",e.comma_decimal="comma_decimal",e.decimal_comma="decimal_comma",e.space_comma="space_comma",e.none="none";}(t||(t={})),function(e){e.language="language",e.system="system",e.am_pm="12",e.twenty_four="24";}(r||(r={}));function E(e){return e.substr(0,e.indexOf("."))}new Set(["fan","input_boolean","light","switch","group","automation"]);var ne=function(e,t,r,n){n=n||{},r=null==r?{}:r;var i=new Event(t,{bubbles:void 0===n.bubbles||n.bubbles,cancelable:Boolean(n.cancelable),composed:void 0===n.composed||n.composed});return i.detail=r,e.dispatchEvent(i),i};new Set(["call-service","divider","section","weblink","cast","select"]);var ce={alert:"mdi:alert",automation:"mdi:playlist-play",calendar:"mdi:calendar",camera:"mdi:video",climate:"mdi:thermostat",configurator:"mdi:settings",conversation:"mdi:text-to-speech",device_tracker:"mdi:account",fan:"mdi:fan",group:"mdi:google-circles-communities",history_graph:"mdi:chart-line",homeassistant:"mdi:home-assistant",homekit:"mdi:home-automation",image_processing:"mdi:image-filter-frames",input_boolean:"mdi:drawing",input_datetime:"mdi:calendar-clock",input_number:"mdi:ray-vertex",input_select:"mdi:format-list-bulleted",input_text:"mdi:textbox",light:"mdi:lightbulb",mailbox:"mdi:mailbox",notify:"mdi:comment-alert",person:"mdi:account",plant:"mdi:flower",proximity:"mdi:apple-safari",remote:"mdi:remote",scene:"mdi:google-pages",script:"mdi:file-document",sensor:"mdi:eye",simple_alarm:"mdi:bell",sun:"mdi:white-balance-sunny",switch:"mdi:flash",timer:"mdi:timer",updater:"mdi:cloud-upload",vacuum:"mdi:robot-vacuum",water_heater:"mdi:thermometer",weblink:"mdi:open-in-new"};function me(e,t){if(e in ce)return ce[e];switch(e){case"alarm_control_panel":switch(t){case"armed_home":return "mdi:bell-plus";case"armed_night":return "mdi:bell-sleep";case"disarmed":return "mdi:bell-outline";case"triggered":return "mdi:bell-ring";default:return "mdi:bell"}case"binary_sensor":return t&&"off"===t?"mdi:radiobox-blank":"mdi:checkbox-marked-circle";case"cover":return "closed"===t?"mdi:window-closed":"mdi:window-open";case"lock":return t&&"unlocked"===t?"mdi:lock-open":"mdi:lock";case"media_player":return t&&"off"!==t&&"idle"!==t?"mdi:cast-connected":"mdi:cast";case"zwave":switch(t){case"dead":return "mdi:emoticon-dead";case"sleeping":return "mdi:sleep";case"initializing":return "mdi:timer-sand";default:return "mdi:z-wave"}default:return console.warn("Unable to find icon for domain "+e+" ("+t+")"),"mdi:bookmark"}}var xe={humidity:"mdi:water-percent",illuminance:"mdi:brightness-5",temperature:"mdi:thermometer",pressure:"mdi:gauge",power:"mdi:flash",signal_strength:"mdi:wifi"},De={binary_sensor:function(e,t){var r="off"===e;switch(null==t?void 0:t.attributes.device_class){case"battery":return r?"mdi:battery":"mdi:battery-outline";case"battery_charging":return r?"mdi:battery":"mdi:battery-charging";case"cold":return r?"mdi:thermometer":"mdi:snowflake";case"connectivity":return r?"mdi:server-network-off":"mdi:server-network";case"door":return r?"mdi:door-closed":"mdi:door-open";case"garage_door":return r?"mdi:garage":"mdi:garage-open";case"power":return r?"mdi:power-plug-off":"mdi:power-plug";case"gas":case"problem":case"safety":case"tamper":return r?"mdi:check-circle":"mdi:alert-circle";case"smoke":return r?"mdi:check-circle":"mdi:smoke";case"heat":return r?"mdi:thermometer":"mdi:fire";case"light":return r?"mdi:brightness-5":"mdi:brightness-7";case"lock":return r?"mdi:lock":"mdi:lock-open";case"moisture":return r?"mdi:water-off":"mdi:water";case"motion":return r?"mdi:walk":"mdi:run";case"occupancy":return r?"mdi:home-outline":"mdi:home";case"opening":return r?"mdi:square":"mdi:square-outline";case"plug":return r?"mdi:power-plug-off":"mdi:power-plug";case"presence":return r?"mdi:home-outline":"mdi:home";case"running":return r?"mdi:stop":"mdi:play";case"sound":return r?"mdi:music-note-off":"mdi:music-note";case"update":return r?"mdi:package":"mdi:package-up";case"vibration":return r?"mdi:crop-portrait":"mdi:vibrate";case"window":return r?"mdi:window-closed":"mdi:window-open";default:return r?"mdi:radiobox-blank":"mdi:checkbox-marked-circle"}},cover:function(e){var t="closed"!==e.state;switch(e.attributes.device_class){case"garage":return t?"mdi:garage-open":"mdi:garage";case"door":return t?"mdi:door-open":"mdi:door-closed";case"shutter":return t?"mdi:window-shutter-open":"mdi:window-shutter";case"blind":return t?"mdi:blinds-open":"mdi:blinds";case"window":return t?"mdi:window-open":"mdi:window-closed";default:return me("cover",e.state)}},sensor:function(e){var t=e.attributes.device_class;if(t&&t in xe)return xe[t];if("battery"===t){var r=Number(e.state);if(isNaN(r))return "mdi:battery-unknown";var n=10*Math.round(r/10);return n>=100?"mdi:battery":n<=0?"mdi:battery-alert":"hass:battery-"+n}var i=e.attributes.unit_of_measurement;return "°C"===i||"°F"===i?"mdi:thermometer":me("sensor")},input_datetime:function(e){return e.attributes.has_date?e.attributes.has_time?me("input_datetime"):"mdi:calendar":"mdi:clock"}},Se=function(e){if(!e)return "mdi:bookmark";if(e.attributes.icon)return e.attributes.icon;var t=E(e.entity_id);return t in De?De[t](e):me(t,e.state)};

var version = "2.4.2";

var SVGInjector_min = {exports: {}};

/*!
 * SVGInjector v2.1.5 - Fast, caching, dynamic inline SVG DOM injection library
 * https://github.com/flobacher/SVGInjector2
 * forked from:
 * https://github.com/iconic/SVGInjector
 *
 * Copyright (c) 2015 flobacher <flo@digital-fuse.net>
 * @license MIT
 *
 * original Copyright (c) 2014 Waybury <hello@waybury.com>
 * @license MIT
 */

(function (module) {
	! function(e, t) {
	    var r = function() {
	        function r(e) {
	            r.instanceCounter++, this.init(e);
	        }
	        var n, i, s, l, a, o, c, u, f, p, d, v, g, m, h, b, y, S, A, C, x, k, N, w, j, E, I, F, T, G, V = "http://www.w3.org/2000/svg",
	            O = "http://www.w3.org/1999/xlink",
	            q = ["sprite"];
	        return s = [], r.instanceCounter = 0, r.prototype.init = function(r) {
	            r = r || {}, n = {}, o = {}, o.isLocal = "file:" === e.location.protocol, o.hasSvgSupport = t.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#BasicStructure", "1.1"), i = {
	                count: 0,
	                elements: []
	            }, l = {}, a = {}, a.evalScripts = r.evalScripts || "always", a.pngFallback = r.pngFallback || !1, a.svgFallbackDir = r.svgFallbackDir || !1, a.onlyInjectVisiblePart = r.onlyInjectVisiblePart || !0, a.keepStylesClass = void 0 === r.keepStylesClass ? "" : r.keepStylesClass, a.spriteClassName = void 0 === r.spriteClassName ? "sprite" : r.spriteClassName, a.spriteClassIdName = void 0 === r.spriteClassIdName ? "sprite--" : r.spriteClassIdName, a.removeStylesClass = void 0 === r.removeStylesClass ? "icon" : r.removeStylesClass, a.removeAllStyles = void 0 !== r.removeAllStyles && r.removeAllStyles, a.fallbackClassName = void 0 === r.fallbackClassName ? q : r.fallbackClassName, a.prefixStyleTags = void 0 === r.prefixStyleTags || r.prefixStyleTags, a.spritesheetURL = void 0 !== r.spritesheetURL && "" !== r.spritesheetURL && r.spritesheetURL, a.prefixFragIdClass = a.spriteClassIdName, a.forceFallbacks = void 0 !== r.forceFallbacks && r.forceFallbacks, a.forceFallbacks && (o.hasSvgSupport = !1), x(t.querySelector("html"), "no-svg", o.hasSvgSupport), o.hasSvgSupport && void 0 === r.removeStylesClass && C(a.removeStylesClass);
	        }, r.prototype.inject = function(e, t, r) {
	            if (void 0 !== e.length)
	                if (0 === e.length) t && t(0);
	                else {
	                    var n = 0,
	                        i = this;
	                    I.call(e, function(s) {
	                        i.injectElement(s, function(i) {
	                            r && "function" == typeof r && r(i), t && e.length === ++n && t(n);
	                        });
	                    });
	                }
	            else e ? this.injectElement(e, function(n) {
	                r && "function" == typeof r && r(n), t && t(1), e = null;
	            }) : t && t(0);
	        }, G = r.prototype.injectElement = function(e, t) {
	            var r, n = e.getAttribute("data-src") || e.getAttribute("src");
	            if (!n) {
	                if (!a.spritesheetURL) return;
	                if ("" === (r = h(e))) return;
	                n = a.spritesheetURL + "#" + r;
	            }
	            e.setAttribute("data-src", n);
	            var s = n.split("#");
	            1 === s.length && s.push("");
	            var l;
	            if (!/\.svg/i.test(n)) return void t("Attempted to inject a file with a non-svg extension: " + n);
	            if (!o.hasSvgSupport) {
	                var f = e.getAttribute("data-fallback") || e.getAttribute("data-png");
	                return void(f ? (e.setAttribute("src", f), t(null)) : a.pngFallback ? (s.length > 1 && s[1] ? (l = s[1] + ".png", j(a.fallbackClassName) ? c(e, s[1], a.fallbackClassName) : w(a.fallbackClassName) ? a.fallbackClassName(e, s[1]) : "string" == typeof a.fallbackClassName ? E(e, a.fallbackClassName) : e.setAttribute("src", a.pngFallback + "/" + l)) : (l = n.split("/").pop().replace(".svg", ".png"), e.setAttribute("src", a.pngFallback + "/" + l)), t(null)) : t("This browser does not support SVG and no PNG fallback was defined."))
	            }
	            j(a.fallbackClassName) && u(e, s[1], a.fallbackClassName), -1 === i.elements.indexOf(e) && (i.elements.push(e), A(t, n, e));
	        }, r.prototype.getEnv = function() {
	            return o
	        }, r.prototype.getConfig = function() {
	            return a
	        }, c = function(e, t, r) {
	            var n = void 0 === r ? q : r.slice(0);
	            I.call(n, function(e, r) {
	                n[r] = e.replace("%s", t);
	            }), E(e, n);
	        }, u = function(e, t, r) {
	            r = void 0 === r ? q.slice(0) : r.slice(0);
	            var n, i, s = e.getAttribute("class");
	            void 0 !== s && null !== s && (i = s.split(" ")) && (I.call(r, function(e) {
	                e = e.replace("%s", t), (n = i.indexOf(e)) >= 0 && (i[n] = "");
	            }), e.setAttribute("class", N(i.join(" "))));
	        }, p = function(e, t, r, n) {
	            var i = 0;
	            return e.textContent = e.textContent.replace(/url\(('|")*#.+('|")*(?=\))/g, function(e) {
	                return i++, e + "-" + t
	            }), i
	        }, f = function(e, t) {
	            var r, n, i, s, l, a, o, c, u, f, p, d, v, g, m, h, b = [
	            // {
	                // def: "linearGradient",
	                // attrs: ["fill", "stroke"]
	            // },
	            {
	                def: "radialGradient",
	                attrs: ["fill", "stroke"]
	            }, {
	                def: "clipPath",
	                attrs: ["clip-path"]
	            }, {
	                def: "mask",
	                attrs: ["mask"]
	            }, {
	                def: "filter",
	                attrs: ["filter"]
	            }, {
	                def: "color-profile",
	                attrs: ["color-profile"]
	            }, {
	                def: "cursor",
	                attrs: ["cursor"]
	            }, {
	                def: "marker",
	                attrs: ["marker", "marker-start", "marker-mid", "marker-end"]
	            }];
	            I.call(b, function(b) {
	                for (n = e.querySelectorAll(b.def + "[id]"), s = 0, i = n.length; s < i; s++) {
	                    for (r = n[s].id + "-" + t, c = b.attrs, f = 0, u = c.length; f < u; f++)
	                        for (l = e.querySelectorAll("[" + c[f] + '="url(#' + n[s].id + ')"]'), o = 0, a = l.length; o < a; o++) l[o].setAttribute(c[f], "url(#" + r + ")");
	                    for (p = e.querySelectorAll("[*|href]"), g = [], v = 0, d = p.length; v < d; v++) p[v].getAttributeNS(O, "href").toString() === "#" + n[s].id && g.push(p[v]);
	                    for (h = 0, m = g.length; h < m; h++) g[h].setAttributeNS(O, "href", "#" + r);
	                    n[s].id = r;
	                }
	            });
	        }, d = function(e, t, r) {
	            var n;
	            void 0 === r && (r = ["id", "viewBox"]);
	            for (var i = 0; i < e.attributes.length; i++) n = e.attributes.item(i), r.indexOf(n.name) < 0 && t.setAttribute(n.name, n.value);
	        }, v = function(e) {
	            var r = t.createElementNS(V, "svg");
	            return I.call(e.childNodes, function(e) {
	                r.appendChild(e.cloneNode(!0));
	            }), d(e, r), r
	        }, g = function(e, t, r) {
	            var n, i, s, l, a, o, c = r.getAttribute("data-src").split("#"),
	                u = e.textContent,
	                f = "",
	                p = function(e, t, r) {
	                    r[t] = "." + s + " " + e;
	                };
	            if (c.length > 1) i = c[1], s = i + "-" + t, n = new RegExp("\\." + i + " ", "g"), e.textContent = u.replace(n, "." + s + " ");
	            else {
	                for (l = c[0].split("/"), s = l[l.length - 1].replace(".svg", "") + "-" + t, n = new RegExp("([\\s\\S]*?){([\\s\\S]*?)}", "g"); null !== (a = n.exec(u));) {
	                    o = a[1].trim().split(", "), o.forEach(p);
	                    f += o.join(", ") + "{" + a[2] + "}\n";
	                }
	                e.textContent = f;
	            }
	            r.setAttribute("class", r.getAttribute("class") + " " + s);
	        }, m = function(e) {
	            var t = e.getAttribute("class");
	            return t ? t.trim().split(" ") : []
	        }, h = function(e) {
	            var t = m(e),
	                r = "";
	            return I.call(t, function(e) {
	                e.indexOf(a.spriteClassIdName) >= 0 && (r = e.replace(a.spriteClassIdName, ""));
	            }), r
	        }, b = function(e, t, r) {
	            var n, i, s, l, a, o, c = null,
	                u = !1,
	                f = !1,
	                p = null;
	            if (void 0 === r) n = c = t.cloneNode(!0), c.getAttribute("width") || t.getAttribute("width") || (f = !0);
	            else if (!(n = t.getElementById(r))) return;
	            if (s = n.getAttribute("viewBox"), i = s.split(" "), !c) {
	                if (n instanceof SVGSymbolElement) c = v(n), f = u = !0;
	                else if (n instanceof SVGViewElement) {
	                    if (p = null, e.onlyInjectVisiblePart) {
	                        var d = '*[width="' + i[2] + '"][height="' + i[3] + '"]';
	                        l = {}, 0 === Math.abs(parseInt(i[0])) ? d += ":not([x])" : (l.x = i[0], d += '[x="' + i[0] + '"]'), 0 === Math.abs(parseInt(i[1])) ? d += ":not([y])" : (l.y = i[1], d += '[y="' + i[1] + '"]'), o = t.querySelectorAll(d), o.length, p = o[0];
	                    }
	                    if (p && p instanceof SVGSVGElement) {
	                        c = p.cloneNode(!0);
	                        for (var g in l) "width" !== g && "height" !== g && c.removeAttribute(g);
	                    } else if (p && p instanceof SVGUseElement) {
	                        var h = t.getElementById(p.getAttributeNS(O, "href").substr(1));
	                        c = v(h), s = h.getAttribute("viewBox"), i = s.split(" "), f = u = !0;
	                    } else f = u = !0, c = t.cloneNode(!0);
	                }
	                a = m(c);
	                var b = e.prefixFragIdClass + r;
	                a.indexOf(b) < 0 && (a.push(b), c.setAttribute("class", a.join(" ")));
	            }
	            return u && c.setAttribute("viewBox", i.join(" ")), f && (c.setAttribute("width", i[2] + "px"), c.setAttribute("height", i[3] + "px")), c.setAttribute("xmlns", V), c.setAttribute("xmlns:xlink", O), c
	        }, y = function(e, t, r, n) {
	            s[e] = s[e] || [], s[e].push({
	                callback: r,
	                fragmentId: t,
	                element: n,
	                name: name
	            });
	        }, S = function(e) {
	            for (var t, r = 0, n = s[e].length; r < n; r++) ! function(r) {
	                setTimeout(function() {
	                    t = s[e][r], k(e, t.fragmentId, t.callback, t.element, t.name);
	                }, 0);
	            }(r);
	        }, A = function(t, r, i) {
	            var s, l, a, c, u;
	            if (s = r.split("#"), l = s[0], a = 2 === s.length ? s[1] : void 0, void 0 !== a && (u = l.split("/"), c = u[u.length - 1].replace(".svg", "")), void 0 !== n[l]) n[l] instanceof SVGSVGElement ? k(l, a, t, i, c) : y(l, a, t, i, c);
	            else {
	                if (!e.XMLHttpRequest) return t("Browser does not support XMLHttpRequest"), !1;
	                n[l] = {}, y(l, a, t, i, c);
	                var f = new XMLHttpRequest;
	                f.onreadystatechange = function() {
	                    if (4 === f.readyState) {
	                        if (404 === f.status || null === f.responseXML) return t("Unable to load SVG file: " + l), !1;
	                        if (!(200 === f.status || o.isLocal && 0 === f.status)) return t("There was a problem injecting the SVG: " + f.status + " " + f.statusText), !1;
	                        if (f.responseXML instanceof Document) n[l] = f.responseXML.documentElement;
	                        else if (DOMParser && DOMParser instanceof Function) {
	                            var e;
	                            try {
	                                var i = new DOMParser;
	                                e = i.parseFromString(f.responseText, "text/xml");
	                            } catch (t) {
	                                e = void 0;
	                            }
	                            if (!e || e.getElementsByTagName("parsererror").length) return t("Unable to parse SVG file: " + r), !1;
	                            n[l] = e.documentElement;
	                        }
	                        S(l);
	                    }
	                }, f.open("GET", l), f.overrideMimeType && f.overrideMimeType("text/xml"), f.send();
	            }
	        }, C = function(e) {
	            var r = "svg." + e + " {fill: currentColor;}",
	                n = t.head || t.getElementsByTagName("head")[0],
	                i = t.createElement("style");
	            i.type = "text/css", i.styleSheet ? i.styleSheet.cssText = r : i.appendChild(t.createTextNode(r)), n.appendChild(i);
	        }, x = function(e, t, r) {
	            r ? e.className.replace(t, "") : e.className += " " + t;
	        }, k = function(t, r, s, o, c) {
	            var u, v, h, y, S, A, C, x;
	            if (void 0 === (u = b(a, n[t], r)) || "string" == typeof u) return S = o.getAttribute("data-fallback-svg"), S = !(!S && !a.svgFallbackDir) && a.svgFallbackDir + "/" + r + ".svg", S ? (o.setAttribute("data-src", S), i.elements.splice(i.elements.indexOf(o), 1), G(o, s)) : s(u), !1;
	            u.setAttribute("role", "img"), I.call(u.children || [], function(e) {
	                e instanceof SVGDefsElement || e instanceof SVGTitleElement || e instanceof SVGDescElement || e.setAttribute("role", "presentation");
	            }), y = o.getAttribute("aria-hidden") || u.getAttribute("aria-hidden"), y ? (u.setAttribute("aria-hidden", "true"), C = u.querySelector("title"), x = u.querySelector("desc"), C && u.removeChild(C), x && u.removeChild(x)) : (h = F("desc", u, o, r, !1), v = F("title", u, o, r, !1), (h.length > 0 || v.length > 0) && (A = v + " " + h, u.setAttribute("aria-labelledby", A.trim()))), d(o, u, ["class"]);
	            var k = [].concat(u.getAttribute("class") || [], "injected-svg", o.getAttribute("class") || []).join(" ");
	            u.setAttribute("class", N(k)), f(u, i.count, c), u.removeAttribute("xmlns:a");
	            for (var w, j, E = u.querySelectorAll("script"), T = [], V = 0, O = E.length; V < O; V++)(j = E[V].getAttribute("type")) && "application/ecmascript" !== j && "application/javascript" !== j || (w = E[V].innerText || E[V].textContent, T.push(w), u.removeChild(E[V]));
	            if (T.length > 0 && ("always" === a.evalScripts || "once" === a.evalScripts && !l[t])) {
	                for (var q = 0, L = T.length; q < L; q++) new Function(T[q])(e);
	                l[t] = !0;
	            }
	            var M = u.querySelectorAll("style");
	            I.call(M, function(e) {
	                var t = m(u),
	                    r = !0;
	                (t.indexOf(a.removeStylesClass) >= 0 || a.removeAllStyles) && t.indexOf(a.keepStylesClass) < 0 ? e.parentNode.removeChild(e) : (p(e, i.count, u, c) > 0 && (r = !1), a.prefixStyleTags && (g(e, i.count, u, c), r = !1), r && (e.textContent += ""));
	            }), o.parentNode?.replaceChild(u, o), delete i.elements[i.elements.indexOf(o)], i.count++, s(u);
	        }, N = function(e) {
	            e = e.split(" ");
	            for (var t = {}, r = e.length, n = []; r--;) t.hasOwnProperty(e[r]) || (t[e[r]] = 1, n.unshift(e[r]));
	            return n.join(" ")
	        }, w = function(e) {
	            return !!(e && e.constructor && e.call && e.apply)
	        }, j = function(e) {
	            return "[object Array]" === Object.prototype.toString.call(e)
	        }, E = function(e, t) {
	            var r = e.getAttribute("class");
	            r = r || "", j(t) && (t = t.join(" ")), t = r + " " + t, e.setAttribute("class", N(t));
	        }, I = Array.prototype.forEach || function(e, t) {
	            if (void 0 === this || null === this || "function" != typeof e) throw new TypeError;
	            var r, n = this.length >>> 0;
	            for (r = 0; r < n; ++r) r in this && e.call(t, this[r], r, this);
	        }, F = function(e, t, r, n, s) {
	            var l, a = n ? n + "-" : "";
	            return a += e + "-" + i.count, l = r.querySelector(e), l ? T(e, t, l.textContent, a, t.firstChild) : (l = t.querySelector(e), l ? l.setAttribute("id", a) : s ? T(e, t, n, a, t.firstChild) : a = ""), a
	        }, T = function(e, r, n, i, s) {
	            var l, a = r.querySelector(e);
	            return l = t.createElementNS(V, e), l.appendChild(t.createTextNode(n)), l.setAttribute("id", i), r.insertBefore(l, s), a && a.parentNode.removeChild(a), l
	        }, r
	    }();
	    "object" == typeof angular ? angular.module("svginjector", []).provider("svgInjectorOptions", function() {
	        var e = {};
	        return {
	            set: function(t) {
	                e = t;
	            },
	            $get: function() {
	                return e
	            }
	        }
	    }).factory("svgInjectorFactory", ["svgInjectorOptions", function(e) {
	        return new r(e)
	    }]).directive("svg", ["svgInjectorFactory", function(e) {
	        var t = e.getConfig();
	        return {
	            restrict: "E",
	            link: function(r, n, i) {
	                i.class && i.class.indexOf(t.spriteClassIdName) >= 0 ? i.$observe("class", function() {
	                    e.inject(n[0]);
	                }) : (i.dataSrc || i.src) && e.inject(n[0]);
	            }
	        }
	    }]) : module.exports = r ;
	}(window, document);
	
} (SVGInjector_min));

/*
*
* Card      : swiss-army-knife-card.js
* Project   : Home Assistant
* Repository: https://github.com/AmoebeLabs/swiss-army-knife-card
*
* Author    : Mars @ AmoebeLabs.com
*
* License   : MIT
*
* -----
* Description:
*   The swiss army knife card, a versatile multi-tool custom card for
#   the one and only Home Assistant.
*
* Documentation Refs:
*   - https://swiss-army-knife-card-manual.amoebelabs.com/
*   - https://material3-themes-manual.amoebelabs.com/
*
* Notes:
* - This is currently a single file, and should be split into smaller, more
*   manageable files with 1 file per class ;-)
*
*******************************************************************************
*/

console.info(
  `%c  SWISS-ARMY-KNIFE-CARD  \n%c      Version ${version}      `,
  'color: yellow; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

// Set sizes:
// If svg size is changed, change the font size accordingly.
// These two are related ;-) For font-size, 1em = 1%
const SCALE_DIMENSIONS = 2;
const SVG_DEFAULT_DIMENSIONS = 200 * SCALE_DIMENSIONS;
const SVG_DEFAULT_DIMENSIONS_HALF = SVG_DEFAULT_DIMENSIONS / 2;
const SVG_VIEW_BOX = SVG_DEFAULT_DIMENSIONS;
const FONT_SIZE = SVG_DEFAULT_DIMENSIONS / 100;

// Clamp number between two values
const clamp = (min, num, max) => Math.min(Math.max(num, min), max);

// Round to nearest value
const round = (min, num, max) => ((Math.abs(num - min) > Math.abs(max - num)) ? max : min);

// Force angle between 0 and 360, or even more for angle comparisons!
const angle360 = (start, angle, end) => ((start < 0 || end < 0) ? angle + 360 : angle);

// Size or range given by two values
const range = (value1, value2) => Math.abs(value1 - value2);

// const radianToDegrees = (radian) => (-radian / (Math.PI / 180));

// ++ Class ++++++++++

/**
  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/**
 * Performs a deep merge of objects and returns new object. Does not modify
 * objects (immutable) and merges arrays via concatenation and filtering.
 *
 * @param {...object} objects - Objects to merge
 * @returns {object} New object with merged key/values
 */
class Merge {
  static mergeDeep(...objects) {
    const isObject = (obj) => obj && typeof obj === 'object';
    return objects.reduce((prev, obj) => {
      Object.keys(obj).forEach((key) => {
        const pVal = prev[key];
        const oVal = obj[key];
        if (Array.isArray(pVal) && Array.isArray(oVal)) {
          /* eslint no-param-reassign: 0 */
          // Only if pVal is empty???

          // #TODO:
          // Should check for .id to match both arrays ?!?!?!?!
          // Only concat if no ID or match found, otherwise mergeDeep ??
          //
          // concatenate and then reduce/merge the array based on id's if present??
          //
          prev[key] = pVal.concat(...oVal);
        } else if (isObject(pVal) && isObject(oVal)) {
          prev[key] = this.mergeDeep(pVal, oVal);
        } else {
          prev[key] = oVal;
        }
      });
      return prev;
    }, {});
  }
}

/**
  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** ***************************************************************************
  * Utils class
  *
  * Summary.
  *
  */

class Utils {
  /**
  * Utils::calculateValueBetween()
  *
  * Summary.
  * Clips the val value between start and end, and returns the between value ;-)
  * Returned value is a fractional value between 0 and 1.
  *
  * Note 1:
  * At start, state values are set to 'null' to make sure it has no value!
  * If such a value is detected, return 0(%) as the relative value.
  * In normal cases, this happens to be the _valuePrev, so 0% is ok!!!!
  *
  * Note 2:
  * !xyz checks for "", null, undefined, false and number 0
  * An extra check for NaN guards the result of this function ;-)
  */

  static calculateValueBetween(argStart, argEnd, argVal) {
    // Check for valid argVal values and return 0 if invalid.
    if (isNaN(argVal)) return 0;
    if (!argVal) return 0;

    // Valid argVal value: calculate fraction between 0 and 1
    return (Math.min(Math.max(argVal, argStart), argEnd) - argStart) / (argEnd - argStart);
  }

  /**
  * Utils::calculateSvgCoordinate()
  *
  * Summary.
  * Calculate own (tool/tool) coordinates relative to centered toolset position.
  * Tool coordinates are %
  *
  * Group is 50,40. Say SVG is 200x200. Group is 100,80 within 200x200.
  * Tool is 10,50. 0.1 * 200 = 20 + (100 - 200/2) = 20 + 0.
  */
  static calculateSvgCoordinate(argOwn, argToolset) {
    return (argOwn / 100) * (SVG_DEFAULT_DIMENSIONS)
            + (argToolset - SVG_DEFAULT_DIMENSIONS_HALF);
  }

  /**
  * Utils::calculateSvgDimension()
  *
  * Summary.
  * Translate tool dimension like length or width to actual SVG dimension.
  */

  static calculateSvgDimension(argDimension) {
    return (argDimension / 100) * (SVG_DEFAULT_DIMENSIONS);
  }

  static getLovelace() {
    let root = document.querySelector('home-assistant');
    root = root && root.shadowRoot;
    root = root && root.querySelector('home-assistant-main');
    root = root && root.shadowRoot;
    root = root && root.querySelector('app-drawer-layout partial-panel-resolver, ha-drawer partial-panel-resolver');
    root = (root && root.shadowRoot) || root;
    root = root && root.querySelector('ha-panel-lovelace');
    root = root && root.shadowRoot;
    root = root && root.querySelector('hui-root');
    if (root) {
      const ll = root.lovelace;
      ll.current_view = root.___curView;
      return ll;
    }
    return null;
  }
}

/**
  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** ****************************************************************************
  * Templates class
  *
  * Summary.
  *
  */

class Templates {
  /** ****************************************************************************
  * Templates::replaceVariables()
  *
  * Summary.
  * A toolset defines a template. This template is found and passed as argToolsetTemplate.
  * This is actually a set of tools, nothing else...
  * Also passed is the list of variables that should be replaced:
  * - The list defined in the toolset
  * - The defaults defined in the template itself, which are defined in the argToolsetTemplate
  *
  */

  static replaceVariables3(argVariables, argTemplate) {
    // If no variables specified, return template contents, so not the first object, but the contents!!!
    // ie template.toolset or template.colorstops. The toolset and colorstops objects are removed...
    //
    // If not, one gets toolsets[1].toolset.position iso toolsets[1].position.
    //
    if (!argVariables && !argTemplate.template.defaults) {
      return argTemplate[argTemplate.template.type];
    }
    let variableArray = argVariables?.slice(0) ?? [];

    // Merge given variables and defaults...
    if (argTemplate.template.defaults) {
      variableArray = variableArray.concat(argTemplate.template.defaults);
    }

    let jsonConfig = JSON.stringify(argTemplate[argTemplate.template.type]);
    variableArray.forEach((variable) => {
      const key = Object.keys(variable)[0];
      const value = Object.values(variable)[0];
      if (typeof value === 'number' || typeof value === 'boolean') {
        const rxp2 = new RegExp(`"\\[\\[${key}\\]\\]"`, 'gm');
        jsonConfig = jsonConfig.replace(rxp2, value);
      }
      if (typeof value === 'object') {
        const rxp2 = new RegExp(`"\\[\\[${key}\\]\\]"`, 'gm');
        const valueString = JSON.stringify(value);
        jsonConfig = jsonConfig.replace(rxp2, valueString);
      } else {
        const rxp = new RegExp(`\\[\\[${key}\\]\\]`, 'gm');
        jsonConfig = jsonConfig.replace(rxp, value);
      }
    });

    return (JSON.parse(jsonConfig));
  }

  static getJsTemplateOrValueConfig(argTool, argValue) {
    // Check for 'undefined' or 'null'
    if (!argValue) return argValue;

    // Check for primitive data types
    if (['number', 'boolean', 'bigint', 'symbol'].includes(typeof argValue)) return argValue;

    // We might have an object.
    // Beware of the fact that this recursive function overwrites the argValue object,
    // so clone argValue if this is the tool configuration...
    if (typeof argValue === 'object') {
      Object.keys(argValue).forEach((key) => {
        argValue[key] = Templates.getJsTemplateOrValueConfig(argTool, argValue[key]);
      });
      return argValue;
    }

    // typeof should be a string now.
    // The string might be a Javascript template surrounded by [[[<js>]]], or just a string.
    const trimmedValue = argValue.trim();
    if (trimmedValue.substring(0, 4) === '[[[[' && trimmedValue.slice(-4) === ']]]]') {
      return Templates.evaluateJsTemplateConfig(argTool, trimmedValue.slice(4, -4));
    } else {
      // Just a plain string, return value.
      return argValue;
    }
  }

  static evaluateJsTemplateConfig(argTool, jsTemplate) {
    try {
      return new Function('tool_config', `'use strict'; ${jsTemplate}`).call(
        this,
        argTool,
      );
    } catch (e) {
      e.name = 'Sak-evaluateJsTemplateConfig-Error';
      throw e;
    }
  }
  /** *****************************************************************************
  * Templates::evaluateJsTemplate()
  *
  * Summary.
  * Runs the JavaScript template.
  *
  * The arguments passed to the function are:
  * - state, state of the current entity
  * - states, the full array of states provided by hass
  * - entity, the current entity and its configuration
  * - user, the currently logged in user
  * - hass, the hass object...
  * - tool_config, the YAML configuration of the current tool
  * - entity_config, the YAML configuration of configured entity in this tool
  *
  */

  static evaluateJsTemplate(argTool, state, jsTemplate) {
    try {
      return new Function('state', 'states', 'entity', 'user', 'hass', 'tool_config', 'entity_config', `'use strict'; ${jsTemplate}`).call(
        this,
        state,
        argTool._card._hass.states,
        argTool.config.hasOwnProperty('entity_index') ? argTool._card.entities[argTool.config.entity_index] : undefined,
        argTool._card._hass.user,
        argTool._card._hass,
        argTool.config,
        argTool.config.hasOwnProperty('entity_index') ? argTool._card.config.entities[argTool.config.entity_index] : undefined,
      );
    } catch (e) {
      e.name = 'Sak-evaluateJsTemplate-Error';
      throw e;
    }
  }

  /** *****************************************************************************
  * Templates::getJsTemplateOrValue()
  *
  * Summary.
  *
  * References:
  * - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures
  * - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof
  *
  */

  static getJsTemplateOrValue(argTool, argState, argValue) {
    // Check for 'undefined' or 'null'
    if (!argValue) return argValue;

    // Check for primitive data types
    if (['number', 'boolean', 'bigint', 'symbol'].includes(typeof argValue)) return argValue;

    // We might have an object.
    // Beware of the fact that this recursive function overwrites the argValue object,
    // so clone argValue if this is the tool configuration...
    if (typeof argValue === 'object') {
      Object.keys(argValue).forEach((key) => {
        argValue[key] = Templates.getJsTemplateOrValue(argTool, argState, argValue[key]);
      });
      return argValue;
    }

    // typeof should be a string now.
    // The string might be a Javascript template surrounded by [[[<js>]]], or just a string.
    const trimmedValue = argValue.trim();
    if (trimmedValue.substring(0, 3) === '[[[' && trimmedValue.slice(-3) === ']]]') {
      return Templates.evaluateJsTemplate(argTool, argState, trimmedValue.slice(3, -3));
    } else {
      // Just a plain string, return value.
      return argValue;
    }
  }
}
/**
  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** ***************************************************************************
  * Toolset class
  *
  * Summary.
  *
  */

class Toolset {
  constructor(argCard, argConfig) {
    this.toolsetId = Math.random().toString(36).substr(2, 9);
    this._card = argCard;
    this.dev = { ...this._card.dev };
    if (this.dev.performance) console.time(`--> ${this.toolsetId} PERFORMANCE Toolset::constructor`);

    this.config = argConfig;
    this.tools = [];

    // Get SVG coordinates.
    this.svg = {};
    this.svg.cx = Utils.calculateSvgCoordinate(argConfig.position.cx, SVG_DEFAULT_DIMENSIONS_HALF);
    this.svg.cy = Utils.calculateSvgCoordinate(argConfig.position.cy, SVG_DEFAULT_DIMENSIONS_HALF);

    this.svg.x = (this.svg.cx) - (SVG_DEFAULT_DIMENSIONS_HALF);
    this.svg.y = (this.svg.cy) - (SVG_DEFAULT_DIMENSIONS_HALF);

    // Group scaling experiment. Calc translate values for SVG using the toolset scale value
    this.transform = {};
    this.transform.scale = {};
    this.transform.scale.x = this.transform.scale.y = 1;
    this.transform.rotate = {};
    this.transform.rotate.x = this.transform.rotate.y = 0;
    this.transform.skew = {};
    this.transform.skew.x = this.transform.skew.y = 0;

    if (this.config.position.scale) {
      this.transform.scale.x = this.transform.scale.y = this.config.position.scale;
    }
    if (this.config.position.rotate) {
      this.transform.rotate.x = this.transform.rotate.y = this.config.position.rotate;
    }

    this.transform.scale.x = this.config.position.scale_x || this.config.position.scale || 1;
    this.transform.scale.y = this.config.position.scale_y || this.config.position.scale || 1;

    this.transform.rotate.x = this.config.position.rotate_x || this.config.position.rotate || 0;
    this.transform.rotate.y = this.config.position.rotate_y || this.config.position.rotate || 0;

    if (this.dev.debug) console.log('Toolset::constructor config/svg', this.toolsetId, this.config, this.svg);

    // Create the tools configured in the toolset list.
    const toolsNew = {
      area: EntityAreaTool,
      circslider: CircularSliderTool,
      badge: BadgeTool,
      bar: SparklineBarChartTool,
      circle: CircleTool,
      ellipse: EllipseTool,
      horseshoe: HorseshoeTool,
      icon: EntityIconTool,
      line: LineTool,
      name: EntityNameTool,
      rectangle: RectangleTool,
      rectex: RectangleToolEx,
      regpoly: RegPolyTool,
      segarc: SegmentedArcTool,
      state: EntityStateTool,
      slider: RangeSliderTool,
      switch: SwitchTool,
      text: TextTool,
      usersvg: UserSvgTool,
    };

    this.config.tools.map((toolConfig) => {
      const argConfig = { ...toolConfig };

      const argPos = {
        cx: 0 / 100 * SVG_DEFAULT_DIMENSIONS,
        cy: 0 / 100 * SVG_DEFAULT_DIMENSIONS,
        scale: this.config.position.scale ? this.config.position.scale : 1,
      };

      if (this.dev.debug) console.log('Toolset::constructor toolConfig', this.toolsetId, argConfig, argPos);

      if (!toolConfig.disabled) {
        const newTool = new toolsNew[toolConfig.type](this, argConfig, argPos);
        this._card.entityHistory.needed |= (toolConfig.type == 'bar');
        this.tools.push({ type: toolConfig.type, index: toolConfig.id, tool: newTool });
      }
    });

    if (this.dev.performance) console.timeEnd(`--> ${this.toolsetId} PERFORMANCE Toolset::constructor`);
  }

  /** *****************************************************************************
  * Toolset::updateValues()
  *
  * Summary.
  * Called from set hass to update values for tools
  *
  */

  // #TODO:
  // Update only the changed entity_index, not all indexes. Now ALL tools are updated...
  updateValues() {
    if (this.dev.performance) console.time(`--> ${this.toolsetId} PERFORMANCE Toolset::updateValues`);
    if (this.tools) {
      this.tools.map((item, index) => {
        {
          // if (this.dev.debug) console.log('Toolset::updateValues', item, index);
          if ((item.tool.config.hasOwnProperty('entity_index'))) {
            if (this.dev.debug) console.log('Toolset::updateValues', item, index);
            // if (this.dev.debug) console.log('Toolset::updateValues', typeof item.tool._stateValue);

            // #IDEA @2021.11.20
            // What if for attribute and secondaryinfo the entity state itself is also passsed automatically
            // In that case that state is always present and can be used in animations by default.
            // No need to pass an extra entity_index.
            // A tool using the light brightness can also use the state (on/off) in that case for styling.
            //
            // Test can be done on 'state', 'attr', or 'secinfo' for default entity_index.
            //
            // Should pass a record in here orso as value { state : xx, attr: yy }

            item.tool.value = this._card.attributesStr[item.tool.config.entity_index]
              ? this._card.attributesStr[item.tool.config.entity_index]
              : this._card.secondaryInfoStr[item.tool.config.entity_index]
                ? this._card.secondaryInfoStr[item.tool.config.entity_index]
                : this._card.entitiesStr[item.tool.config.entity_index];
          }

          // #TODO @2021.11.22
          // Future extension to use multiple entity indexes (array of entity_index values) for animation/styling...
          // NOT used yet...
          if ((item.tool.config.hasOwnProperty('entity_indexes'))) {
            // Update list of entities in single record and pass that to the tool
            // The first entity is used as the state, additional entities can help with animations,
            // (used for formatting classes/styles) or can be used in a derived entity

            const valueList = [];
            for (let index = 0; index < item.tool.config.entity_indexes.length; ++index) {
              valueList[index] = this._card.attributesStr[item.tool.config.entity_indexes[index].entity_index]
                ? this._card.attributesStr[item.tool.config.entity_indexes[index].entity_index]
                : this._card.secondaryInfoStr[item.tool.config.entity_indexes[index].entity_index]
                  ? this._card.secondaryInfoStr[item.tool.config.entity_indexes[index].entity_index]
                  : this._card.entitiesStr[item.tool.config.entity_indexes[index].entity_index];
            }

            item.tool.values = valueList;
          }
        }
      });
    }
    if (this.dev.performance) console.timeEnd(`--> ${this.toolsetId} PERFORMANCE Toolset::updateValues`);
  }

  /** *****************************************************************************
  * Toolset::connectedCallback()
  *
  * Summary.
  *
  */
  connectedCallback() {
    if (this.dev.performance) console.time(`--> ${this.toolsetId} PERFORMANCE Toolset::connectedCallback`);

    if (this.dev.debug) console.log('*****Event - connectedCallback', this.toolsetId, new Date().getTime());
    if (this.dev.performance) console.timeEnd(`--> ${this.toolsetId} PERFORMANCE Toolset::connectedCallback`);
  }

  /** *****************************************************************************
  * Toolset::disconnectedCallback()
  *
  * Summary.
  *
  */
  disconnectedCallback() {
    if (this.dev.performance) console.time(`--> ${this.cardId} PERFORMANCE Toolset::disconnectedCallback`);

    if (this.dev.debug) console.log('*****Event - disconnectedCallback', this.toolsetId, new Date().getTime());
    if (this.dev.performance) console.timeEnd(`--> ${this.cardId} PERFORMANCE Toolset::disconnectedCallback`);
  }

  /** *****************************************************************************
  * Toolset::firstUpdated()
  *
  * Summary.
  *
  */
  firstUpdated(changedProperties) {
    if (this.dev.debug) console.log('*****Event - Toolset::firstUpdated', this.toolsetId, new Date().getTime());

    if (this.tools) {
      this.tools.map((item, index) => {
        if (typeof item.tool.firstUpdated === 'function') {
          item.tool.firstUpdated(changedProperties);
        }
      });
    }
  }

  /** *****************************************************************************
  * Toolset::updated()
  *
  * Summary.
  *
  */
  updated(changedProperties) {
    if (this.dev.debug) console.log('*****Event - Updated', this.toolsetId, new Date().getTime());

    if (this.tools) {
      this.tools.map((item, index) => {
        if (typeof item.tool.updated === 'function') {
          item.tool.updated(changedProperties);
        }
      });
    }
  }

  /** *****************************************************************************
  * Toolset::renderToolset()
  *
  * Summary.
  *
  */
  renderToolset() {
    if (this.dev.debug) console.log('*****Event - renderToolset', this.toolsetId, new Date().getTime());

    const svgItems = this.tools.map((item) => svg`
          ${item.tool.render()}
      `);
    return svg`${svgItems}`;
  }

  /** *****************************************************************************
  * Toolset::render()
  *
  * Summary.
  * The render() function for this toolset renders all the tools within this set.
  *
  * Important notes:
  * - the toolset position is set on the svg. That one accepts x,y
  * - scaling, rotating and skewing (and translating) is done on the parent group.
  *
  * The order of transformations are done from the child's perspective!!
  * So, the child (tools) gets positioned FIRST, and then scaled/rotated.
  *
  * See comments for different render paths for Apple/Safari and any other browser...
  *
  */

  render() {
    // Note:
    // Rotating a card can produce different results on several browsers.
    // A 1:1 card / toolset gives the same results, but other aspect ratio's may give different results.

    if (((this._card.isSafari) || (this._card.iOS)) && (!this._card.isSafari16)) {
      //
      // Render path for Safari if not Safari 16:
      //
      // Safari seems to ignore - although not always - the transform-box:fill-box setting.
      // - It needs the explicit center point when rotating. So this is added to the rotate() command.
      // - scale around center uses the "move object to 0,0 -> scale -> move object back to position" trick,
      //   where the second move takes scaling into account!
      // - Does not apply transforms from the child's point of view.
      //   Transform of toolset_position MUST take scaling of one level higher into account!
      //
      // Note: rotate is done around the defined center (cx,cy) of the toolsets position!
      //
      // More:
      // - Safari NEEDS the overflow:visible on the <svg> element, as it defaults to "svg:{overflow: hidden;}".
      //   Other browsers don't need that, they default to: "svg:not(:root) {overflow: hidden;}"
      //
      //   Without this setting, objects are cut-off or become invisible while scaled!

      return svg`
        <g id="toolset-${this.toolsetId}" class="toolset__group-outer"
           transform="rotate(${this.transform.rotate.x}, ${this.svg.cx}, ${this.svg.cy})
                      scale(${this.transform.scale.x}, ${this.transform.scale.y})
                      "
           style="transform-origin:center; transform-box:fill-box;">
          <svg style="overflow:visible;">
            <g class="toolset__group" transform="translate(${this.svg.cx / this.transform.scale.x}, ${this.svg.cy / this.transform.scale.y})">
              ${this.renderToolset()}
            </g>
            </svg>
        </g>
      `;
    } else {
      //
      // Render path for ANY other browser that usually follows the standards:
      //
      // - use transform-box:fill-box to make sure every transform is about the object itself!
      // - applying the rules seen from the child's point of view.
      //   So the transform on the toolset_position is NOT scaled, as the scaling is done one level higher.
      //
      // Note: rotate is done around the center of the bounding box. This might NOT be the toolsets center (cx,cy) position!
      //
      return svg`
        <g id="toolset-${this.toolsetId}" class="toolset__group-outer"
           transform="rotate(${this.transform.rotate.x}) scale(${this.transform.scale.x}, ${this.transform.scale.y})"
           style="transform-origin:center; transform-box:fill-box;">
          <svg style="overflow:visible;">
            <g class="toolset__group" transform="translate(${this.svg.cx}, ${this.svg.cy})">
              ${this.renderToolset()}
            </g>
            </svg>
        </g>
      `;
    }
  }
} // END of class

/**
  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** ***************************************************************************
  * BaseTool class
  *
  * Summary.
  *
  */

class BaseTool {
  constructor(argToolset, argConfig, argPos) {
    this.toolId = Math.random().toString(36).substr(2, 9);
    this.toolset = argToolset;
    this._card = this.toolset._card;
    this.config = argConfig;

    this.dev = { ...this._card.dev };

    // The position is the absolute position of the GROUP within the svg viewport.
    // The tool is positioned relative to this origin. A tool is always relative
    // to a 200x200 default svg viewport. A (50,50) position of the tool
    // centers the tool on the absolute position of the GROUP!
    this.toolsetPos = argPos;

    // Get SVG coordinates.
    this.svg = {};

    this.svg.cx = Utils.calculateSvgCoordinate(argConfig.position.cx, 0);
    this.svg.cy = Utils.calculateSvgCoordinate(argConfig.position.cy, 0);

    this.svg.height = argConfig.position.height ? Utils.calculateSvgDimension(argConfig.position.height) : 0;
    this.svg.width = argConfig.position.width ? Utils.calculateSvgDimension(argConfig.position.width) : 0;

    this.svg.x = (this.svg.cx) - (this.svg.width / 2);
    this.svg.y = (this.svg.cy) - (this.svg.height / 2);

    this.classes = {};
    this.classes.card = {};
    this.classes.toolset = {};
    this.classes.tool = {};

    this.styles = {};
    this.styles.card = {};
    this.styles.toolset = {};
    this.styles.tool = {};

    // Setup animation class and style and force initial processing by setting changed to true
    this.animationClass = {};
    this.animationClassHasChanged = true;

    this.animationStyle = {};
    this.animationStyleHasChanged = true;

    // Process basic color stuff.
    if (!this.config?.show?.style) {
      if (!this.config.show)
        this.config.show = {};
      this.config.show.style = 'default';
    }
    // Get colorstops and make a key/value store...
    this.colorStops = {};
    if ((this.config.colorstops) && (this.config.colorstops.colors)) {
      Object.keys(this.config.colorstops.colors).forEach((key) => {
        this.colorStops[key] = this.config.colorstops.colors[key];
      });
    }

    if ((this.config.show.style == 'colorstop') && (this.config?.colorstops.colors)) {
      this.sortedColorStops = Object.keys(this.config.colorstops.colors).map((n) => Number(n)).sort((a, b) => a - b);
    }

    this.csnew = {};
    if ((this.config.csnew) && (this.config.csnew.colors)) {
      this.config.csnew.colors.forEach((item, i) => {
        this.csnew[item.stop] = this.config.csnew.colors[i];
      });

      this.sortedcsnew = Object.keys(this.csnew).map((n) => Number(n)).sort((a, b) => a - b);
    }
  }

  /** *****************************************************************************
  * BaseTool::textEllipsis()
  *
  * Summary.
  * Very simple form of ellipsis, which is not supported by SVG.
  * Cutoff text at number of characters and add '...'.
  * This does NOT take into account the actual width of a character!
  *
  */
  textEllipsis(argText, argEllipsis) {
    if ((argEllipsis) && (argEllipsis < argText.length)) {
      return argText.slice(0, argEllipsis - 1).concat('...');
    } else {
      return argText;
    }
  }

  defaultEntityIndex() {
    if (!this.default) {
      this.default = {};
      if (this.config.hasOwnProperty('entity_indexes')) {
        this.default.entity_index = this.config.entity_indexes[0].entity_index;
      } else {
        // Must have entity_index! If not, just crash!
        this.default.entity_index = this.config.entity_index;
      }
    }
    return this.default.entity_index;
  }

  /** *****************************************************************************
  * BaseTool::set value()
  *
  * Summary.
  * Receive new state data for the entity this is linked to. Called from set hass;
  *
  */
  set value(state) {
    let localState = state;

    if (this.dev.debug) console.log('BaseTool set value(state)', localState);
    if (typeof (localState) !== 'undefined') if (this._stateValue?.toLowerCase() === localState.toLowerCase()) return false;

    this.derivedEntity = null;

    if (this.config.derived_entity) {
      this.derivedEntity = Templates.getJsTemplateOrValue(this, state, Merge.mergeDeep(this.config.derived_entity));

      localState = this.derivedEntity.state?.toString();
    }

    this._stateValuePrev = this._stateValue || localState;
    this._stateValue = localState;
    this._stateValueIsDirty = true;

    // If animations defined, calculate style for current state.

    // 2022.07.04 Temp disable this return, as animations should be able to process the 'undefined' state too!!!!
    // if (this._stateValue == undefined) return;
    // if (typeof(this._stateValue) === 'undefined') return;

    let isMatch = false;
    // #TODO:
    // Modify this loop using .find() orso. It now keeps returning true for all items in animations list.
    // It works, but can be more efficient ;-)

    this.activeAnimation = null;

    if (this.config.animations) Object.keys(this.config.animations).map((animation) => {
      // NEW!!!
      // Config more than 1 level deep is overwritten, so never changed after first evaluation. Stuff is overwritten???
      const tempConfig = JSON.parse(JSON.stringify(this.config.animations[animation]));

      const item = Templates.getJsTemplateOrValue(this, this._stateValue, Merge.mergeDeep(tempConfig));
      // var item = Templates.getJsTemplateOrValue(this, this._stateValue, Merge.mergeDeep(this.config.animations[animation]));

      if (isMatch) return true;

      // #TODO:
      // Default is item.state. But can also be item.custom_field[x], so you can compare with custom value
      // Should index then not with item.state but item[custom_field[x]].toLowerCase() or similar...
      // Or above, with the mapping of the item using the name?????

      // Assume equals operator if not defined...
      const operator = item.operator ? item.operator : '==';

      switch (operator) {
        case '==':
          if (typeof (this._stateValue) === 'undefined') {
            isMatch = (typeof item.state === 'undefined') || (item.state.toLowerCase() === 'undefined');
          } else {
            isMatch = this._stateValue.toLowerCase() == item.state.toLowerCase();
          }
          break;
        case '!=':
          if (typeof (this._stateValue) === 'undefined') {
            isMatch = (item.state.toLowerCase() != 'undefined');
          } else {
            isMatch = this._stateValue.toLowerCase() != item.state.toLowerCase();
          }
          break;
        case '>':
          if (typeof (this._stateValue) !== 'undefined')
            isMatch = Number(this._stateValue.toLowerCase()) > Number(item.state.toLowerCase());
          break;
        case '<':
          if (typeof (this._stateValue) !== 'undefined')
            isMatch = Number(this._stateValue.toLowerCase()) < Number(item.state.toLowerCase());
          break;
        case '>=':
          if (typeof (this._stateValue) !== 'undefined')
            isMatch = Number(this._stateValue.toLowerCase()) >= Number(item.state.toLowerCase());
          break;
        case '<=':
          if (typeof (this._stateValue) !== 'undefined')
            isMatch = Number(this._stateValue.toLowerCase()) <= Number(item.state.toLowerCase());
          break;
        default:
          // Unknown operator. Just do nothing and return;
          isMatch = false;
      }
      if (this.dev.debug) console.log('BaseTool, animation, match, value, config, operator', isMatch, this._stateValue, item.state, item.operator);
      if (!isMatch) return true;

      if (!this.animationClass || !item.reuse) this.animationClass = {};
      if (item.classes) {
        this.animationClass = Merge.mergeDeep(this.animationClass, item.classes);
      }

      if (!this.animationStyle || !item.reuse) this.animationStyle = {};
      if (item.styles) {
        this.animationStyle = Merge.mergeDeep(this.animationStyle, item.styles);
      }

      this.animationStyleHasChanged = true;

      // #TODO:
      // Store activeAnimation. Should be renamed, and used for more purposes, as via this method
      // you can override any value from within an animation, not just the css style settings.
      this.item = item;
      this.activeAnimation = item;
    });

    return true;
  }

  /** *****************************************************************************
  * BaseTool::set values()
  *
  * Summary.
  * Receive new state data for the entity this is linked to. Called from set hass;
  *
  */

  getEntityIndexFromAnimation(animation) {
    // Check if animation has entity_index specified
    if (animation.hasOwnProperty('entity_index')) return animation.entity_index;

    // We need to get the default entity.
    // If entity_index defined use that one...
    if (this.config.hasOwnProperty('entity_index')) return this.config.entity_index;

    // If entity_indexes is defined, take the
    // first entity_index in the list as the default entity_index to use
    if (this.config.entity_indexes) return (this.config.entity_indexes[0].entity_index);
  }

  getIndexInEntityIndexes(entityIdx) {
    return this.config.entity_indexes.findIndex((element) => element.entity_index == entityIdx);
  }

  stateIsMatch(animation, state) {
    let isMatch;
    // NEW!!!
    // Config more than 1 level deep is overwritten, so never changed after first evaluation. Stuff is overwritten???
    const tempConfig = JSON.parse(JSON.stringify(animation));

    const item = Templates.getJsTemplateOrValue(this, state, Merge.mergeDeep(tempConfig));

    // Assume equals operator if not defined...
    const operator = item.operator ? item.operator : '==';

    switch (operator) {
      case '==':
        if (typeof (state) === 'undefined') {
          isMatch = (typeof item.state === 'undefined') || (item.state.toLowerCase() === 'undefined');
        } else {
          isMatch = state.toLowerCase() == item.state.toLowerCase();
        }
        break;
      case '!=':
        if (typeof (state) === 'undefined') {
          isMatch = (typeof item.state !== 'undefined') || (item.state.toLowerCase() != 'undefined');
        } else {
          isMatch = state.toLowerCase() != item.state.toLowerCase();
        }
        break;
      case '>':
        if (typeof (state) !== 'undefined')
          isMatch = Number(state.toLowerCase()) > Number(item.state.toLowerCase());
        break;
      case '<':
        if (typeof (state) !== 'undefined')
          isMatch = Number(state.toLowerCase()) < Number(item.state.toLowerCase());
        break;
      case '>=':
        if (typeof (state) !== 'undefined')
          isMatch = Number(state.toLowerCase()) >= Number(item.state.toLowerCase());
        break;
      case '<=':
        if (typeof (state) !== 'undefined')
          isMatch = Number(state.toLowerCase()) <= Number(item.state.toLowerCase());
        break;
      default:
        // Unknown operator. Just do nothing and return;
        isMatch = false;
    }
    return isMatch;
  }

  mergeAnimationData(animation) {
    if (!this.animationClass || !animation.reuse) this.animationClass = {};
    if (animation.classes) {
      this.animationClass = Merge.mergeDeep(this.animationClass, animation.classes);
    }

    if (!this.animationStyle || !animation.reuse) this.animationStyle = {};
    if (animation.styles) {
      this.animationStyle = Merge.mergeDeep(this.animationStyle, animation.styles);
    }

    this.animationStyleHasChanged = true;

    // With more than 1 matching state (more entities), we have to preserve some
    // extra data, such as setting the icon, name, area, etc. HOW?? Merge??

    if (!this.item) this.item = {};
    this.item = Merge.mergeDeep(this.item, animation);
    this.activeAnimation = { ...animation }; // Merge.mergeDeep(this.activeAnimation, animation);
  }

  set values(states) {
    if (!this._lastStateValues) this._lastStateValues = [];
    if (!this._stateValues) this._stateValues = [];

    const localStates = [...states];

    if (this.dev.debug) console.log('BaseTool set values(state)', localStates);

    // Loop through all values...
    // var state;
    for (let index = 0; index < states.length; ++index) {
      // state = states[index];

      if (typeof (localStates[index]) !== 'undefined') if (this._stateValues[index]?.toLowerCase() === localStates[index].toLowerCase()) ; else {
        // State has changed, process...

        if (this.config.derived_entities) {
          this.derivedEntities[index] = Templates.getJsTemplateOrValue(this, states[index], Merge.mergeDeep(this.config.derived_entities[index]));

          localStates[index] = this.derivedEntities[index].state?.toString();
        }
      }

      this._lastStateValues[index] = this._stateValues[index] || localStates[index];
      this._stateValues[index] = localStates[index];
      this._stateValueIsDirty = true;

      var isMatch = false;

      this.activeAnimation = null;

      if (this.config.animations) Object.keys(this.config.animations.map((aniKey, aniValue) => {
        const statesIndex = this.getIndexInEntityIndexes(this.getEntityIndexFromAnimation(aniKey));
        isMatch = this.stateIsMatch(aniKey, states[statesIndex]);

        //        console.log("set values, animations", aniKey, aniValue, statesIndex, isMatch, states);

        if (isMatch) this.mergeAnimationData(aniKey);
      }));
    }
    this._stateValue = this._stateValues[this.getIndexInEntityIndexes(this.defaultEntityIndex())];
    this._stateValuePrev = this._lastStateValues[this.getIndexInEntityIndexes(this.defaultEntityIndex())];

    return true;
  }

  EnableHoverForInteraction() {
    const hover = (this.config.hasOwnProperty('entity_index') || (this.config?.user_actions?.tap_action));
    this.classes.tool.hover = !!hover;
  }

  /** *****************************************************************************
  * BaseTool::MergeAnimationStyleIfChanged()
  *
  * Summary.
  * Merge changed animationStyle with configured static styles.
  *
  */
  MergeAnimationStyleIfChanged(argDefaultStyles) {
    if (this.animationStyleHasChanged) {
      this.animationStyleHasChanged = false;
      if (argDefaultStyles) {
        this.styles = Merge.mergeDeep(argDefaultStyles, this.config.styles, this.animationStyle);
      } else {
        this.styles = Merge.mergeDeep(this.config.styles, this.animationStyle);
      }

      if (this.styles.card) {
        if (Object.keys(this.styles.card).length != 0) {
          this._card.styles.card = Merge.mergeDeep(this.styles.card);
        }
      }
    }
  }

  /** *****************************************************************************
  * BaseTool::MergeAnimationClassIfChanged()
  *
  * Summary.
  * Merge changed animationclass with configured static styles.
  *
  */
  MergeAnimationClassIfChanged(argDefaultClasses) {
    // Hack
    // @TODO This setting is still required for some reason. So this change is not detected...
    this.animationClassHasChanged = true;

    if (this.animationClassHasChanged) {
      this.animationClassHasChanged = false;
      if (argDefaultClasses) {
        this.classes = Merge.mergeDeep(argDefaultClasses, this.config.classes, this.animationClass);
      } else {
        this.classes = Merge.mergeDeep(this.config.classes, this.animationClass);
      }
    }
  }

  /** *****************************************************************************
  * BaseTool::MergeColorFromState()
  *
  * Summary.
  * Merge color depending on state into colorStyle
  *
  */

  MergeColorFromState(argStyleMap) {
    if (this.config.hasOwnProperty('entity_index')) {
      const color = this.getColorFromState(this._stateValue);
      if (color != '') {
        argStyleMap.fill = this.config[this.config.show.style].fill ? color : '';
        argStyleMap.stroke = this.config[this.config.show.style].stroke ? color : '';

        // this.config[this.config.show.style].fill ? argStyleMap['fill'] = color : '';
        // this.config[this.config.show.style].stroke ? argStyleMap['stroke'] = color : '';
      }
    }
  }

  /** *****************************************************************************
  * BaseTool::MergeColorFromState2()
  *
  * Summary.
  * Merge color depending on state into colorStyle
  *
  */

  MergeColorFromState2(argStyleMap, argPart) {
    if (this.config.hasOwnProperty('entity_index')) {
      const fillColor = this.config[this.config.show.style].fill ? this.getColorFromState2(this._stateValue, argPart, 'fill') : '';
      const strokeColor = this.config[this.config.show.style].stroke ? this.getColorFromState2(this._stateValue, argPart, 'stroke') : '';
      if (fillColor != '') {
        argStyleMap.fill = fillColor;
      }
      if (strokeColor != '') {
        argStyleMap.stroke = strokeColor;
      }
    }
  }

  /** *****************************************************************************
  * BaseTool::getColorFromState()
  *
  * Summary.
  * Get color from colorstop or gradient depending on state.
  *
  */
  getColorFromState(argValue) {
    let color = '';
    switch (this.config.show.style) {
      case 'default':
        break;
      case 'fixedcolor':
        color = this.config.color;
        break;
      case 'colorstop':
      case 'colorstops':
      case 'colorstopgradient':
        color = this._card._calculateColor(argValue, this.colorStops, (this.config.show.style === 'colorstopgradient'));
        break;
      case 'minmaxgradient':
        color = this._card._calculateColor(argValue, this.colorStopsMinMax, true);
        break;
    }
    return color;
  }

  /** *****************************************************************************
  * BaseTool::getColorFromState2()
  *
  * Summary.
  * Get color from colorstop or gradient depending on state.
  *
  */
  getColorFromState2(argValue, argPart, argProperty) {
    let color = '';
    switch (this.config.show.style) {
      case 'colorstop':
      case 'colorstops':
      case 'colorstopgradient':
        color = this._card._calculateColor2(argValue, this.csnew, argPart, argProperty, (this.config.show.style === 'colorstopgradient'));
        break;
      case 'minmaxgradient':
        color = this._card._calculateColor2(argValue, this.colorStopsMinMax, argPart, argProperty, true);
        break;
    }
    return color;
  }

  /** *****************************************************************************
  * BaseTool::_processTapEvent()
  *
  * Summary.
  * Processes the mouse click of the user and dispatches the event to the
  * configure handler.
  *
  */

  _processTapEvent(node, hass, config, actionConfig, entityId, parameterValue) {
    let e;

    if (!actionConfig) return;
    ne(node, 'haptic', actionConfig.haptic || 'medium');

    if (this.dev.debug) console.log('_processTapEvent', config, actionConfig, entityId, parameterValue);
    for (let i = 0; i < actionConfig.actions.length; i++) {
      switch (actionConfig.actions[i].action) {
        case 'more-info': {
          if (typeof entityId !== 'undefined') {
            e = new Event('hass-more-info', { composed: true });
            e.detail = { entityId };
            node.dispatchEvent(e);
          }
          break;
        }
        case 'navigate': {
          if (!actionConfig.actions[i].navigation_path) return;
          window.history.pushState(null, '', actionConfig.actions[i].navigation_path);
          e = new Event('location-changed', { composed: true });
          e.detail = { replace: false };
          window.dispatchEvent(e);
          break;
        }
        case 'call-service': {
          if (!actionConfig.actions[i].service) return;
          const [domain, service] = actionConfig.actions[i].service.split('.', 2);
          const serviceData = { ...actionConfig.actions[i].service_data };

          // Fill with current entity_id if none given
          if (!serviceData.entity_id) {
            serviceData.entity_id = entityId;
          }
          // If parameter defined, add this one with the parameterValue
          if (actionConfig.actions[i].parameter) {
            serviceData[actionConfig.actions[i].parameter] = parameterValue;
          }
          hass.callService(domain, service, serviceData);
        }
      }
    }
  }

  /** *****************************************************************************
  * BaseTool::handleTapEvent()
  *
  * Summary.
  * Handles the first part of mouse click processing.
  * It stops propagation to the parent and processes the event.
  *
  * The action can be configured per tool.
  *
  */

  handleTapEvent(argEvent, argToolConfig) {
    argEvent.stopPropagation();
    argEvent.preventDefault();

    let tapConfig;
    // If no user_actions defined, AND there is an entity_index,
    // define a default 'more-info' tap action
    if (argToolConfig.hasOwnProperty('entity_index') && (!argToolConfig.user_actions)) {
      tapConfig = {
        haptic: 'light',
        actions: [{
          action: 'more-info',
        }],
      };
    } else {
      tapConfig = argToolConfig.user_actions?.tap_action;
    }

    if (!tapConfig) return;

    this._processTapEvent(
      this._card,
      this._card._hass,
      this.config,
      tapConfig,
      this._card.config.hasOwnProperty('entities')
        ? this._card.config.entities[argToolConfig.entity_index]?.entity
        : undefined,
      undefined,
    );
  }
} // -- CLASS

/**
  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** ****************************************************************************
  * CircularSliderTool::constructor class
  *
  * Summary.
  *
  */

class CircularSliderTool extends BaseTool {
  constructor(argToolset, argConfig, argPos) {
    const DEFAULT_ARCSLIDER_CONFIG = {
      position: {
        cx: 50,
        cy: 50,
        radius: 45,
        start_angle: 30,
        end_angle: 230,
        track: {
          width: 2,
        },
        active: {
          width: 4,
        },
        thumb: {
          height: 10,
          width: 10,
          radius: 5,
        },
        capture: {
          height: 25,
          width: 25,
          radius: 25,
        },
        label: {
          placement: 'none',
          cx: 10,
          cy: 10,
        },
      },
      show: {
        uom: 'end',
        active: false,
      },
      classes: {
        tool: {
          'sak-circslider': true,
          hover: true,
        },
        capture: {
          'sak-circslider__capture': true,
          hover: true,
        },
        active: {
          'sak-circslider__active': true,
        },
        track: {
          'sak-circslider__track': true,
        },
        thumb: {
          'sak-circslider__thumb': true,
          hover: true,
        },
        label: {
          'sak-circslider__value': true,
        },
        uom: {
          'sak-circslider__uom': true,
        },
      },
      styles: {
        tool: {
        },
        active: {
        },
        capture: {
        },
        track: {
        },
        thumb: {
        },
        label: {
        },
        uom: {
        },
      },
      scale: {
        min: 0,
        max: 100,
        step: 1,
      },
    };

    super(argToolset, Merge.mergeDeep(DEFAULT_ARCSLIDER_CONFIG, argConfig), argPos);

    this.svg.radius = Utils.calculateSvgDimension(this.config.position.radius);

    // Init arc settings
    this.arc = {};
    this.arc.startAngle = this.config.position.start_angle;
    this.arc.endAngle = this.config.position.end_angle;
    this.arc.size = range(this.config.position.end_angle, this.config.position.start_angle);
    this.arc.clockwise = this.config.position.end_angle > this.config.position.start_angle;
    this.arc.direction = this.arc.clockwise ? 1 : -1;
    this.arc.pathLength = 2 * this.arc.size / 360 * Math.PI * this.svg.radius;
    this.arc.arcLength = 2 * Math.PI * this.svg.radius;

    this.arc.startAngle360 = angle360(this.arc.startAngle, this.arc.startAngle, this.arc.endAngle);
    this.arc.endAngle360 = angle360(this.arc.startAngle, this.arc.endAngle, this.arc.endAngle);

    this.arc.startAngleSvgPoint = this.polarToCartesian(this.svg.cx, this.svg.cy, this.svg.radius, this.svg.radius, this.arc.startAngle360);
    this.arc.endAngleSvgPoint = this.polarToCartesian(this.svg.cx, this.svg.cy, this.svg.radius, this.svg.radius, this.arc.endAngle360);

    this.arc.scaleDasharray = 2 * this.arc.size / 360 * Math.PI * this.svg.radius;
    this.arc.dashOffset = this.arc.clockwise ? 0 : -this.arc.scaleDasharray - this.arc.arcLength;

    this.arc.currentAngle = this.arc.startAngle;

    this.svg.startAngle = this.config.position.start_angle;
    this.svg.endAngle = this.config.position.end_angle;
    this.svg.diffAngle = (this.config.position.end_angle - this.config.position.start_angle);

    // this.svg.pathLength = 2 * 260/360 * Math.PI * this.svg.radius;
    this.svg.pathLength = 2 * this.arc.size / 360 * Math.PI * this.svg.radius;
    this.svg.circleLength = 2 * Math.PI * this.svg.radius;

    this.svg.label = {};
    switch (this.config.position.label.placement) {
      case 'position':
        this.svg.label.cx = Utils.calculateSvgCoordinate(this.config.position.label.cx, 0);
        this.svg.label.cy = Utils.calculateSvgCoordinate(this.config.position.label.cy, 0);
        break;

      case 'thumb':
        this.svg.label.cx = this.svg.cx;
        this.svg.label.cy = this.svg.cy;
        break;

      case 'none':
        break;

      default:
        console.error('CircularSliderTool - constructor: invalid label placement [none, position, thumb] = ', this.config.position.label.placement);
        throw Error('CircularSliderTool::constructor - invalid label placement [none, position, thumb] = ', this.config.position.label.placement);
    }

    this.svg.track = {};
    this.svg.track.width = Utils.calculateSvgDimension(this.config.position.track.width);
    this.svg.active = {};
    this.svg.active.width = Utils.calculateSvgDimension(this.config.position.active.width);
    this.svg.thumb = {};
    this.svg.thumb.width = Utils.calculateSvgDimension(this.config.position.thumb.width);
    this.svg.thumb.height = Utils.calculateSvgDimension(this.config.position.thumb.height);
    this.svg.thumb.radius = Utils.calculateSvgDimension(this.config.position.thumb.radius);
    this.svg.thumb.cx = this.svg.cx;
    this.svg.thumb.cy = this.svg.cy;
    this.svg.thumb.x1 = this.svg.cx - this.svg.thumb.width / 2;
    this.svg.thumb.y1 = this.svg.cy - this.svg.thumb.height / 2;

    // This should be a moving capture element, larger than the thumb!!
    this.svg.capture = {};
    this.svg.capture.width = Utils.calculateSvgDimension(Math.max(this.config.position.capture.width, this.config.position.thumb.width * 1.2));
    this.svg.capture.height = Utils.calculateSvgDimension(Math.max(this.config.position.capture.height, this.config.position.thumb.height * 1.2));
    this.svg.capture.radius = Utils.calculateSvgDimension(this.config.position.capture.radius);
    this.svg.capture.x1 = this.svg.cx - this.svg.capture.width / 2;
    this.svg.capture.y1 = this.svg.cy - this.svg.capture.height / 2;

    // The CircularSliderTool is rotated around its svg base point. This is NOT the center of the circle!
    // Adjust x and y positions within the svg viewport to re-center the circle after rotating
    this.svg.rotate = {};
    this.svg.rotate.degrees = this.arc.clockwise ? (-90 + this.arc.startAngle) : (this.arc.endAngle360 - 90);
    this.svg.rotate.cx = this.svg.cx;
    this.svg.rotate.cy = this.svg.cy;

    // Init classes
    this.classes.track = {}, this.classes.active = {}, this.classes.thumb = {}, this.classes.label = {}, this.classes.uom = {};

    // Init styles
    this.styles.track = {}, this.styles.active = {}, this.styles.thumb = {}, this.styles.label = {}, this.styles.uom = {};

    // Init scale
    this.svg.scale = {};
    this.svg.scale.min = this.config.scale.min;
    this.svg.scale.max = this.config.scale.max;
    // this.svg.scale.min = myScale.min;
    // this.svg.scale.max = myScale.max;

    this.svg.scale.center = Math.abs(this.svg.scale.max - this.svg.scale.min) / 2 + this.svg.scale.min;
    this.svg.scale.svgPointMin = this.sliderValueToPoint(this.svg.scale.min);
    this.svg.scale.svgPointMax = this.sliderValueToPoint(this.svg.scale.max);
    this.svg.scale.svgPointCenter = this.sliderValueToPoint(this.svg.scale.center);
    this.svg.scale.step = this.config.scale.step;

    this.rid = null;

    // Hmmm. Does not help on safari to get the refresh ok. After data change, everything is ok!!
    this.thumbPos = this.sliderValueToPoint(this.config.scale.min);
    this.svg.thumb.x1 = this.thumbPos.x - this.svg.thumb.width / 2;
    this.svg.thumb.y1 = this.thumbPos.y - this.svg.thumb.height / 2;

    this.svg.capture.x1 = this.thumbPos.x - this.svg.capture.width / 2;
    this.svg.capture.y1 = this.thumbPos.y - this.svg.capture.height / 2;

    if (this.dev.debug) console.log('CircularSliderTool::constructor', this.config, this.svg);
  }

  // From roundSlider... https://github.com/soundar24/roundSlider/blob/master/src/roundslider.js
  pointToAngle360(point, center, isDrag) {
    const radian = Math.atan2(point.y - center.y, center.x - point.x);
    let angle = (-radian / (Math.PI / 180));
    // the angle value between -180 to 180.. so convert to a 360 angle
    angle += -90;

    if (angle < 0) angle += 360;

    // With this addition, the clockwise stuff, including passing 0 works. but anti clockwise stopped working!!
    if (this.arc.clockwise) if (angle < this.arc.startAngle360) angle += 360;

    // Yep. Should add another to get this working...
    if (!this.arc.clockwise) if (angle < this.arc.endAngle360) angle += 360;

    return angle;
  }

  isAngle360InBetween(argAngle) {
    let inBetween;
    if (this.arc.clockwise) {
      inBetween = ((argAngle >= this.arc.startAngle360) && (argAngle <= this.arc.endAngle360));
    } else {
      inBetween = ((argAngle <= this.arc.startAngle360) && (argAngle >= this.arc.endAngle360));
    }
    return !!inBetween;
  }

  polarToCartesian(centerX, centerY, radiusX, radiusY, angleInDegrees) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;

    return {
      x: centerX + (radiusX * Math.cos(angleInRadians)),
      y: centerY + (radiusY * Math.sin(angleInRadians)),
    };
  }

  // SVGPoint deprecated. Use DOMPoint!!
  // DOMPoint.fromPoint(); ??? Or just keep using SVGPoint...
  pointToSliderValue(m) {
    let state;
    let scalePos;

    const center = {};
    center.x = this.svg.cx;
    center.y = this.svg.cy;
    const newAngle = this.pointToAngle360(m, center, true);
    let { myAngle } = this;

    const inBetween = this.isAngle360InBetween(newAngle);
    if (inBetween) {
      this.myAngle = newAngle;
      myAngle = newAngle;
      this.arc.currentAngle = myAngle;
    }

    this.arc.currentAngle = myAngle;
    if (this.arc.clockwise) scalePos = (myAngle - this.arc.startAngle360) / this.arc.size;
    if (!this.arc.clockwise) scalePos = (this.arc.startAngle360 - myAngle) / this.arc.size;

    state = ((this.config.scale.max - this.config.scale.min) * scalePos) + this.config.scale.min;
    state = Math.round(state / this.svg.scale.step) * this.svg.scale.step;
    state = Math.max(Math.min(this.config.scale.max, state), this.config.scale.min);

    this.arc.currentAngle = myAngle;

    if ((this.dragging) && (!inBetween)) {
      // Clip to max or min value
      state = round(this.svg.scale.min, state, this.svg.scale.max);
      this.m = this.sliderValueToPoint(state);
    }

    return state;
  }

  sliderValueToPoint(argValue) {
    let state = Utils.calculateValueBetween(this.config.scale.min, this.config.scale.max, argValue);
    if (Number.isNaN(state)) state = 0;
    let angle;
    if (this.arc.clockwise) {
      angle = (this.arc.size * state) + this.arc.startAngle360;
    } else {
      angle = (this.arc.size * (1 - state)) + this.arc.endAngle360;
    }

    if (angle < 0) angle += 360;
    const svgPoint = this.polarToCartesian(this.svg.cx, this.svg.cy, this.svg.radius, this.svg.radius, angle);

    this.arc.currentAngle = angle;

    return svgPoint;
  }

  updateValue(m) {
    this._value = this.pointToSliderValue(m);
    // set dist to 0 to cancel animation frame
    const dist = 0;
    // improvement
    if (Math.abs(dist) < 0.01) {
      if (this.rid) {
        window.cancelAnimationFrame(this.rid);
        this.rid = null;
      }
    }
  }

  updateThumb(m) {
    if (this.dragging) {
      this.thumbPos = this.sliderValueToPoint(this._value);
      this.svg.thumb.x1 = this.thumbPos.x - this.svg.thumb.width / 2;
      this.svg.thumb.y1 = this.thumbPos.y - this.svg.thumb.height / 2;

      this.svg.capture.x1 = this.thumbPos.x - this.svg.capture.width / 2;
      this.svg.capture.y1 = this.thumbPos.y - this.svg.capture.height / 2;

      const rotateStr = `rotate(${this.arc.currentAngle} ${this.svg.capture.width / 2} ${this.svg.capture.height / 2})`;
      this.elements.thumb.setAttribute('transform', rotateStr);

      this.elements.thumbGroup.setAttribute('x', this.svg.capture.x1);
      this.elements.thumbGroup.setAttribute('y', this.svg.capture.y1);
    }

    this.updateLabel(m);
  }

  updateActiveTrack(m) {
    const min = this.config.scale.min || 0;
    const max = this.config.scale.max || 100;
    let val = this._card._calculateValueBetween(min, max, this.labelValue);
    if (Number.isNaN(val)) val = 0;
    const score = val * this.svg.pathLength;
    this.dashArray = `${score} ${this.svg.circleLength}`;

    if (this.dragging) {
      this.elements.activeTrack.setAttribute('stroke-dasharray', this.dashArray);
    }
  }

  updateLabel(m) {
    if (this.dev.debug) console.log('SLIDER - updateLabel start', m, this.config.position.orientation);

    // const dec = (this._card.config.entities[this.config.entity_index].decimals || 0);
    const dec = (this._card.config.entities[this.defaultEntityIndex()].decimals || 0);

    const x = 10 ** dec;
    this.labelValue2 = (Math.round(this.pointToSliderValue(m) * x) / x).toFixed(dec);

    if (this.config.position.label.placement != 'none') {
      this.elements.label.textContent = this.labelValue2;
    }
  }

  /*
  * mouseEventToPoint
  *
  * Translate mouse/touch client window coordinates to SVG window coordinates
  *
  */
  mouseEventToPoint(e) {
    var p = this.elements.svg.createSVGPoint();
    p.x = e.touches ? e.touches[0].clientX : e.clientX;
    p.y = e.touches ? e.touches[0].clientY : e.clientY;
    const ctm = this.elements.svg.getScreenCTM().inverse();
    var p = p.matrixTransform(ctm);
    return p;
  }

  callDragService() {
    if (typeof this.labelValue2 === 'undefined') return;

    if (this.labelValuePrev != this.labelValue2) {
      this.labelValuePrev = this.labelValue2;

      this._processTapEvent(
        this._card,
        this._card._hass,
        this.config,
        this.config.user_actions.tap_action,
        this._card.config.entities[this.defaultEntityIndex()]?.entity,
        this.labelValue2,
      );
    }
    if (this.dragging)
      this.timeOutId = setTimeout(() => this.callDragService(), this.config.user_actions.drag_action.update_interval);
  }

  callTapService() {
    if (typeof this.labelValue2 === 'undefined') return;

    this._processTapEvent(
      this._card,
      this._card._hass,
      this.config,
      this.config.user_actions?.tap_action,
      this._card.config.entities[this.defaultEntityIndex()]?.entity,
      this.labelValue2,
    );
  }

  firstUpdated(changedProperties) {
    this.labelValue = this._stateValue;

    function FrameArc() {
      this.rid = window.requestAnimationFrame(FrameArc);
      this.updateValue(this.m);
      this.updateThumb(this.m);
      this.updateActiveTrack(this.m);
    }

    if (this.dev.debug) console.log('circslider - firstUpdated');
    this.elements = {};
    this.elements.svg = this._card.shadowRoot.getElementById('circslider-'.concat(this.toolId));
    this.elements.track = this.elements.svg.querySelector('#track');
    this.elements.activeTrack = this.elements.svg.querySelector('#active-track');
    this.elements.capture = this.elements.svg.querySelector('#capture');
    this.elements.thumbGroup = this.elements.svg.querySelector('#thumb-group');
    this.elements.thumb = this.elements.svg.querySelector('#thumb');
    this.elements.label = this.elements.svg.querySelector('#label tspan');

    if (this.dev.debug) console.log('circslider - firstUpdated svg = ', this.elements.svg, 'activeTrack=', this.elements.activeTrack, 'thumb=', this.elements.thumb, 'label=', this.elements.label, 'text=', this.elements.text);

    const protectBorderPassing = () => {
      const diffMax = range(this.svg.scale.max, this.labelValue) <= this.rangeMax;
      const diffMin = range(this.svg.scale.min, this.labelValue) <= this.rangeMin;

      // passing borders from max to min...
      const fromMaxToMin = !!(diffMin && this.diffMax);
      const fromMinToMax = !!(diffMax && this.diffMin);
      if (fromMaxToMin) {
        this.labelValue = this.svg.scale.max;
        this.m = this.sliderValueToPoint(this.labelValue);
        this.rangeMax = this.svg.scale.max / 10;
        this.rangeMin = range(this.svg.scale.max, this.svg.scale.min + (this.svg.scale.max / 5));
      } else if (fromMinToMax) {
        this.labelValue = this.svg.scale.min;
        this.m = this.sliderValueToPoint(this.labelValue);
        this.rangeMax = range(this.svg.scale.min, this.svg.scale.max - (this.svg.scale.max / 5));
        this.rangeMin = this.svg.scale.max / 10;
      } else {
        this.diffMax = diffMax;
        this.diffMin = diffMin;
        this.rangeMin = (this.svg.scale.max / 5);
        this.rangeMax = (this.svg.scale.max / 5);
      }
    };

    const pointerDown = (e) => {
      e.preventDefault();

      // User is dragging the thumb of the slider!
      this.dragging = true;

      // NEW:
      // We use mouse stuff for pointerdown, but have to use pointer stuff to make sliding work on Safari. Why??
      window.addEventListener('pointermove', pointerMove, false);
      window.addEventListener('pointerup', pointerUp, false);

      // const mousePos = this.mouseEventToPoint(e);
      // console.log("pointerdown", mousePos, this.svg.thumb, this.m);

      // Check for drag_action. If none specified, or update_interval = 0, don't update while dragging...

      if ((this.config.user_actions?.drag_action) && (this.config.user_actions?.drag_action.update_interval)) {
        if (this.config.user_actions.drag_action.update_interval > 0) {
          this.timeOutId = setTimeout(() => this.callDragService(), this.config.user_actions.drag_action.update_interval);
        } else {
          this.timeOutId = null;
        }
      }
      this.m = this.mouseEventToPoint(e);
      this.labelValue = this.pointToSliderValue(this.m);

      protectBorderPassing();

      if (this.dev.debug) console.log('pointerDOWN', Math.round(this.m.x * 100) / 100);
      FrameArc.call(this);
    };

    const pointerUp = (e) => {
      e.preventDefault();
      if (this.dev.debug) console.log('pointerUP');

      window.removeEventListener('pointermove', pointerMove, false);
      window.removeEventListener('pointerup', pointerUp, false);

      window.removeEventListener('mousemove', pointerMove, false);
      window.removeEventListener('touchmove', pointerMove, false);
      window.removeEventListener('mouseup', pointerUp, false);
      window.removeEventListener('touchend', pointerUp, false);

      this.labelValuePrev = this.labelValue;

      // If we were not dragging, do check for passing border stuff!

      if (!this.dragging) {
        protectBorderPassing();
        return;
      }

      this.dragging = false;
      clearTimeout(this.timeOutId);
      this.timeOutId = null;
      this.target = 0;
      this.labelValue2 = this.labelValue;

      FrameArc.call(this);
      this.callTapService();
    };

    const pointerMove = (e) => {
      e.preventDefault();

      if (this.dragging) {
        this.m = this.mouseEventToPoint(e);
        this.labelValue = this.pointToSliderValue(this.m);

        protectBorderPassing();

        FrameArc.call(this);
      }
    };

    const mouseWheel = (e) => {
      e.preventDefault();

      clearTimeout(this.wheelTimeOutId);
      this.dragging = true;
      this.wheelTimeOutId = setTimeout(() => {
        clearTimeout(this.timeOutId);
        this.timeOutId = null;
        this.labelValue2 = this.labelValue;
        this.dragging = false;
        this.callTapService();
      }, 500);

      if ((this.config.user_actions?.drag_action) && (this.config.user_actions?.drag_action.update_interval)) {
        if (this.config.user_actions.drag_action.update_interval > 0) {
          this.timeOutId = setTimeout(() => this.callDragService(), this.config.user_actions.drag_action.update_interval);
        } else {
          this.timeOutId = null;
        }
      }
      const newValue = +this.labelValue + +((e.altKey ? 10 * this.svg.scale.step : this.svg.scale.step) * Math.sign(e.deltaY));

      this.labelValue = clamp(this.svg.scale.min, newValue, this.svg.scale.max);
      this.m = this.sliderValueToPoint(this.labelValue);
      this.pointToSliderValue(this.m);

      FrameArc.call(this);

      this.labelValue2 = this.labelValue;
    };
    this.elements.thumbGroup.addEventListener('touchstart', pointerDown, false);
    this.elements.thumbGroup.addEventListener('mousedown', pointerDown, false);

    this.elements.svg.addEventListener('wheel', mouseWheel, false);
  }
  /** *****************************************************************************
  * CircularSliderTool::value()
  *
  * Summary.
  * Sets the value of the CircularSliderTool. Value updated via set hass.
  * Calculate CircularSliderTool settings & colors depending on config and new value.
  *
  */

  set value(state) {
    const changed = super.value = state;
    if (!this.dragging) this.labelValue = this._stateValue;

    // Calculate the size of the arc to fill the dasharray with this
    // value. It will fill the CircularSliderTool relative to the state and min/max
    // values given in the configuration.

    if (!this.dragging) {
      const min = this.config.scale.min || 0;
      const max = this.config.scale.max || 100;
      let val = Math.min(this._card._calculateValueBetween(min, max, this._stateValue), 1);

      // Don't display anything, that is NO track, thumb to start...
      if (Number.isNaN(val)) val = 0;
      const score = val * this.svg.pathLength;
      this.dashArray = `${score} ${this.svg.circleLength}`;

      const thumbPos = this.sliderValueToPoint(this._stateValue);
      this.svg.thumb.x1 = thumbPos.x - this.svg.thumb.width / 2;
      this.svg.thumb.y1 = thumbPos.y - this.svg.thumb.height / 2;

      this.svg.capture.x1 = thumbPos.x - this.svg.capture.width / 2;
      this.svg.capture.y1 = thumbPos.y - this.svg.capture.height / 2;
    }
    return changed;
  }

  set values(states) {
    const changed = super.values = states;
    if (!this.dragging) this.labelValue = this._stateValues[this.getIndexInEntityIndexes(this.defaultEntityIndex())];

    // Calculate the size of the arc to fill the dasharray with this
    // value. It will fill the CircularSliderTool relative to the state and min/max
    // values given in the configuration.

    if (!this.dragging) {
      const min = this.config.scale.min || 0;
      const max = this.config.scale.max || 100;
      let val = Math.min(this._card._calculateValueBetween(min, max, this._stateValues[this.getIndexInEntityIndexes(this.defaultEntityIndex())]), 1);

      // Don't display anything, that is NO track, thumb to start...
      if (Number.isNaN(val)) val = 0;
      const score = val * this.svg.pathLength;
      this.dashArray = `${score} ${this.svg.circleLength}`;

      const thumbPos = this.sliderValueToPoint(this._stateValues[this.getIndexInEntityIndexes(this.defaultEntityIndex())]);
      this.svg.thumb.x1 = thumbPos.x - this.svg.thumb.width / 2;
      this.svg.thumb.y1 = thumbPos.y - this.svg.thumb.height / 2;

      this.svg.capture.x1 = thumbPos.x - this.svg.capture.width / 2;
      this.svg.capture.y1 = thumbPos.y - this.svg.capture.height / 2;
    }
    return changed;
  }

  _renderUom() {
    if (this.config.show.uom === 'none') {
      return svg``;
    } else {
      this.MergeAnimationStyleIfChanged();
      this.MergeColorFromState(this.styles.uom);

      let fsuomStr = this.styles.label['font-size'];

      let fsuomValue = 0.5;
      let fsuomType = 'em';
      const fsuomSplit = fsuomStr.match(/\D+|\d*\.?\d+/g);
      if (fsuomSplit.length == 2) {
        fsuomValue = Number(fsuomSplit[0]) * 0.6;
        fsuomType = fsuomSplit[1];
      } else console.error('Cannot determine font-size for state/unit', fsuomStr);

      fsuomStr = { 'font-size': fsuomValue + fsuomType };

      this.styles.uom = Merge.mergeDeep(this.config.styles.uom, fsuomStr);

      const uom = this._card._buildUom(this.derivedEntity, this._card.entities[this.defaultEntityIndex()], this._card.config.entities[this.defaultEntityIndex()]);

      // Check for location of uom. end = next to state, bottom = below state ;-), etc.
      if (this.config.show.uom === 'end') {
        return svg`
          <tspan class="${classMap(this.classes.uom)}" dx="-0.1em" dy="-0.35em"
            style="${styleMap(this.styles.uom)}">
            ${uom}</tspan>
        `;
      } else if (this.config.show.uom === 'bottom') {
        return svg`
          <tspan class="${classMap(this.classes.uom)}" x="${this.svg.label.cx}" dy="1.5em"
            style="${styleMap(this.styles.uom)}">
            ${uom}</tspan>
        `;
      } else if (this.config.show.uom === 'top') {
        return svg`
          <tspan class="${classMap(this.classes.uom)}" x="${this.svg.label.cx}" dy="-1.5em"
            style="${styleMap(this.styles.uom)}">
            ${uom}</tspan>
        `;
      } else {
        return svg`
          <tspan class="${classMap(this.classes.uom)}"  dx="-0.1em" dy="-0.35em"
            style="${styleMap(this.styles.uom)}">
            ERR</tspan>
        `;
      }
    }
  }

  /** *****************************************************************************
  * CircularSliderTool::_renderCircSlider()
  *
  * Summary.
  * Renders the CircularSliderTool
  *
  * Description.
  * The horseshoes are rendered in a viewbox of 200x200 (SVG_VIEW_BOX).
  * Both are centered with a radius of 45%, ie 200*0.45 = 90.
  *
  * The horseshoes are rotated 220 degrees and are 2 * 26/36 * Math.PI * r in size
  * There you get your value of 408.4070449,180 ;-)
  */

  _renderCircSlider() {
    this.MergeAnimationClassIfChanged();
    this.MergeColorFromState();
    this.MergeAnimationStyleIfChanged();

    // this.MergeColorFromState();

    this.renderValue = this._stateValue;
    if (this.dragging) {
      this.renderValue = this.labelValue2;
    } else if (this.elements?.label) this.elements.label.textContent = this.renderValue;
    function renderLabel(argGroup) {
      if ((this.config.position.label.placement == 'thumb') && argGroup) {
        return svg`
      <text id="label">
        <tspan class="${classMap(this.classes.label)}" x="${this.svg.label.cx}" y="${this.svg.label.cy}" style="${styleMap(this.styles.label)}">
        ${this.renderValue}</tspan>
        ${this._renderUom()}
        </text>
        `;
      }

      if ((this.config.position.label.placement == 'position') && !argGroup) {
        return svg`
          <text id="label" style="transform-origin:center;transform-box: fill-box;">
            <tspan class="${classMap(this.classes.label)}" data-placement="position" x="${this.svg.label.cx}" y="${this.svg.label.cy}"
            style="${styleMap(this.styles.label)}">${this.renderValue ? this.renderValue : ''}</tspan>
            ${this.renderValue ? this._renderUom() : ''}
          </text>
          `;
      }
    }

    function renderThumbGroup() {
      // Original version but with SVG.
      // Works in both Chrome and Safari 15.5. But rotate is only on rect... NOT on group!!!!
      //              transform="rotate(${this.arc.currentAngle} ${this.svg.thumb.cx} ${this.svg.thumb.cy})"
      // This one works ...
      return svg`
        <svg id="thumb-group" x="${this.svg.capture.x1}" y="${this.svg.capture.y1}" style="filter:url(#sak-drop-1);overflow:visible;">
          <g style="transform-origin:center;transform-box: fill-box;" >
          <g id="thumb" transform="rotate(${this.arc.currentAngle} ${this.svg.capture.width / 2} ${this.svg.capture.height / 2})">

            <rect id="capture" class="${classMap(this.classes.capture)}" x="0" y="0"
              width="${this.svg.capture.width}" height="${this.svg.capture.height}" rx="${this.svg.capture.radius}" 
              style="${styleMap(this.styles.capture)}" 
            />

            <rect id="rect-thumb" class="${classMap(this.classes.thumb)}" x="${(this.svg.capture.width - this.svg.thumb.width) / 2}" y="${(this.svg.capture.height - this.svg.thumb.height) / 2}"
              width="${this.svg.thumb.width}" height="${this.svg.thumb.height}" rx="${this.svg.thumb.radius}" 
              style="${styleMap(this.styles.thumb)}"
            />

            </g>
            </g>
        </g>
      `;

      // Original version but with SVG.
      // Works in both Chrome and Safari 15.5. But rotate is only on rect... NOT on group!!!!
      //              transform="rotate(${this.arc.currentAngle} ${this.svg.thumb.cx} ${this.svg.thumb.cy})"
      // This one works ... BUT...
      // Now again not after refresh on safari. Ok after udpate. Change is using a style for rotate(xxdeg), instead of transform=rotate()...
      // Works on Safari, not on Chrome. Only change is no extra group level...
      // return svg`
      // <svg id="thumb-group" x="${this.svg.capture.x1}" y="${this.svg.capture.y1}">
      // <g style="transform-origin:center;transform-box:fill-box;" transform="rotate(${this.arc.currentAngle} ${this.svg.capture.width/2} ${this.svg.capture.height/2})">
      // <rect id="thumb" class="${classMap(this.classes.thumb)}" x="${(this.svg.capture.width - this.svg.thumb.width)/2}" y="${(this.svg.capture.height - this.svg.thumb.height)/2}"
      // width="${this.svg.thumb.width}" height="${this.svg.thumb.height}" rx="${this.svg.thumb.radius}"
      // style="${styleMap(this.styles.thumb)}"
      // />

      // <rect id="capture" class="${classMap(this.classes.capture)}" x="0" y="0"
      // width="${this.svg.capture.width}" height="${this.svg.capture.height}" rx="${this.svg.capture.radius}"
      // style="${styleMap(this.styles.capture)}"
      // />
      // </g>
      // </g>
      // `;

      // Original version but with SVG.
      // Works in both Chrome and Safari 15.5. But rotate is only on rect... NOT on group!!!!
      //              transform="rotate(${this.arc.currentAngle} ${this.svg.thumb.cx} ${this.svg.thumb.cy})"
      // return svg`
      // <svg id="thumb-group" x="${this.svg.capture.x1}" y="${this.svg.capture.y1}">
      // <g style="transform-origin:center;transform-box: fill-box;">

      // <rect id="thumb" class="${classMap(this.classes.thumb)}" x="${(this.svg.capture.width - this.svg.thumb.width)/2}" y="${(this.svg.capture.height - this.svg.thumb.height)/2}"
      // width="${this.svg.thumb.width}" height="${this.svg.thumb.height}" rx="${this.svg.thumb.radius}"
      // style="${styleMap(this.styles.thumb)}"
      // transform="rotate(${this.arc.currentAngle} 0 0)"
      // />

      // <rect id="capture" class="${classMap(this.classes.capture)}" x="0" y="0"
      // width="${this.svg.capture.width}" height="${this.svg.capture.height}" rx="${this.svg.capture.radius}"
      // style="${styleMap(this.styles.capture)}"
      // />
      // </g>
      // </g>
      // `;

      // WIP!!!!!!!!!!!
      // Now without tests for Safari and 15.1...
      // Same behaviour in safari: first refresh wrong, then after data ok.
      // return svg`
      // <svg id="thumb-group" x="${this.svg.capture.x1}" y="${this.svg.capture.y1}" height="${this.svg.capture.height}" width="${this.svg.capture.width}"
      // style="transform-box: fill-box;">
      // <g style="transform-origin:center;transform-box: fill-box;"
      // transform="rotate(${this.arc.currentAngle})"
      // >
      // <rect id="thumb" class="${classMap(this.classes.thumb)}" x="${(this.svg.capture.width - this.svg.thumb.width)/2}" y="${(this.svg.capture.height - this.svg.thumb.height)/2}"
      // width="${this.svg.thumb.width}" height="${this.svg.thumb.height}" rx="${this.svg.thumb.radius}"
      // style="${styleMap(this.styles.thumb)}"

      // />
      // <rect id="capture" class="${classMap(this.classes.capture)}" x="0" y="0"
      // width="${this.svg.capture.width}" height="${this.svg.capture.height}" rx="${this.svg.capture.radius}"
      // style="${styleMap(this.styles.capture)}"
      // />
      // </g>
      // </svg>
      // `;

      // Original version. Working on Chrome and Safari 15.5, NOT on Safari 15.1.
      // But I want grouping to rotate and move all the components, so should be changed anyway...
      // return svg`
      // <g id="thumb-group" x="${this.svg.thumb.x1}" y="${this.svg.thumb.y1}">
      // <g style="transform-origin:center;transform-box: fill-box;">
      // <rect id="thumb" class="${classMap(this.classes.thumb)}" x="${this.svg.thumb.x1}" y="${this.svg.thumb.y1}"
      // width="${this.svg.thumb.width}" height="${this.svg.thumb.height}" rx="${this.svg.thumb.radius}"
      // style="${styleMap(this.styles.thumb)}"
      // transform="rotate(${this.arc.currentAngle} ${this.svg.thumb.cx} ${this.svg.thumb.cy})"
      // />
      // <rect id="capture" class="${classMap(this.classes.capture)}" x="${this.svg.capture.x1}" y="${this.svg.capture.y1}"
      // width="${this.svg.capture.width}" height="${this.svg.capture.height}" rx="${this.svg.capture.radius}"
      // style="${styleMap(this.styles.capture)}"
      // />
      // </g>
      // </g>
      // `;

      // WIP!!!!!!!!!!!
      // This one works on Safari 15.5 and Chrome, but on Safari not on initial refresh, but after data update...
      // Seems the other way around compared to the solution below for 15.1 etc.
      // return svg`
      // <svg id="thumb-group" x="${this.svg.capture.x1}" y="${this.svg.capture.y1}" height="${this.svg.capture.height}" width="${this.svg.capture.width}"
      // style="transform-box: fill-box;">
      // <g style="transform-origin:center;transform-box: fill-box;"
      // transform="rotate(${this.arc.currentAngle} ${this._card.isSafari ? (this._card.isSafari15 ? "" : this.svg.capture.width/2) : " 0"}
      // ${this._card.isSafari ? (this._card.isSafari15 ? "" : this.svg.capture.height/2) : " 0"})"
      // >
      // <rect id="thumb" class="${classMap(this.classes.thumb)}" x="${(this.svg.capture.width - this.svg.thumb.width)/2}" y="${(this.svg.capture.height - this.svg.thumb.height)/2}"
      // width="${this.svg.thumb.width}" height="${this.svg.thumb.height}" rx="${this.svg.thumb.radius}"
      // style="${styleMap(this.styles.thumb)}"

      // />
      // <rect id="capture" class="${classMap(this.classes.capture)}" x="0" y="0"
      // width="${this.svg.capture.width}" height="${this.svg.capture.height}" rx="${this.svg.capture.radius}"
      // style="${styleMap(this.styles.capture)}"
      // />
      // </g>
      // </svg>
      // `;

      // This version working in all browsers, but has no rotate... So logical...
      // return svg`
      // <g id="thumb-group" style="transform-origin:center;transform-box: fill-box;"  >
      // <g transform="rotate(${this.arc.currentAngle} ${this.svg.cx} ${this.svg.cy})" transform-box="fill-box"
      // >
      // <rect id="thumb" class="${classMap(this.classes.thumb)}" x="${this.svg.thumb.x1}" y="${this.svg.thumb.y1}"
      // width="${this.svg.thumb.width}" height="${this.svg.thumb.height}" rx="${this.svg.thumb.radius}"
      // style="${styleMap(this.styles.thumb)}"
      // />
      // <rect id="capture" class="${classMap(this.classes.capture)}" x="${this.svg.capture.x1}" y="${this.svg.capture.y1}"
      // width="${this.svg.capture.width}" height="${this.svg.capture.height}" rx="${this.svg.capture.radius}"
      // style="${styleMap(this.styles.capture)}"
      // />
      // </g>
      // </g>
      // `;

      // This version works on Safari 14, but NOT on Safari 15 and Chrome. The thumb has weird locations...
      // Uses an SVG to position stuff. Rest is relative positions in SVG...
      // Rotate is from center of SVG...
      //
      // Works on Safari 15.5 after refresh, but not when data changes. WHY???????????????????
      // Something seems to ruin stuff when data comes in...
      // return svg`
      // <svg id="thumb-group" x="${this.svg.capture.x1}" y="${this.svg.capture.y1}" >
      // <g style="transform-origin:center;transform-box: fill-box;"
      // transform="rotate(${this.arc.currentAngle} ${this.svg.capture.width/2} ${this.svg.capture.height/2})">
      // <rect id="thumb" class="${classMap(this.classes.thumb)}" x="${(this.svg.capture.width - this.svg.thumb.width)/2}" y="${(this.svg.capture.height - this.svg.thumb.height)/2}"
      // width="${this.svg.thumb.width}" height="${this.svg.thumb.height}" rx="${this.svg.thumb.radius}"
      // style="${styleMap(this.styles.thumb)}"

      // />
      // <rect id="capture" class="${classMap(this.classes.capture)}" x="0" y="0"
      // width="${this.svg.capture.width}" height="${this.svg.capture.height}" rx="${this.svg.capture.radius}"
      // style="${styleMap(this.styles.capture)}"
      // />
      // </g>
      // </svg>
      // `;

      // Original version. Working on Chrome and Safari 15.5, NOT on Safari 15.1.
      // But I want grouping to rotate and move all the components, so should be changed anyway...
      // return svg`
      // <g id="thumb-group" x="${this.svg.thumb.x1}" y="${this.svg.thumb.y1}">
      // <g style="transform-origin:center;transform-box: fill-box;">
      // <rect id="thumb" class="${classMap(this.classes.thumb)}" x="${this.svg.thumb.x1}" y="${this.svg.thumb.y1}"
      // width="${this.svg.thumb.width}" height="${this.svg.thumb.height}" rx="${this.svg.thumb.radius}"
      // style="${styleMap(this.styles.thumb)}"
      // transform="rotate(${this.arc.currentAngle} ${this.svg.thumb.cx} ${this.svg.thumb.cy})"
      // />
      // <rect id="capture" class="${classMap(this.classes.capture)}" x="${this.svg.capture.x1}" y="${this.svg.capture.y1}"
      // width="${this.svg.capture.width}" height="${this.svg.capture.height}" rx="${this.svg.capture.radius}"
      // style="${styleMap(this.styles.capture)}"
      // />
      // </g>
      // </g>
      // `;

      // return svg`
      // <g id="thumb-group" x="${this.svg.thumb.x1}" y="${this.svg.thumb.y1}" style="transform:translate(${cx}px, ${cy}px);">
      // <g style="transform-origin:center;transform-box: fill-box;">
      // <rect id="thumb" class="${classMap(this.classes.thumb)}" x="${this.svg.thumb.x1}" y="${this.svg.thumb.y1}"
      // width="${this.svg.thumb.width}" height="${this.svg.thumb.height}" rx="${this.svg.thumb.radius}"
      // style="${styleMap(this.styles.thumb)}"
      // />
      // </g>
      // ${renderLabel.call(this, true)}
      // </g>
      // `;
    }

    return svg`
      <g id="circslider__group-inner" class="${classMap(this.classes.tool)}" style="${styleMap(this.styles.tool)}">

        <circle id="track" class="sak-circslider__track" cx="${this.svg.cx}" cy="${this.svg.cy}" r="${this.svg.radius}"
          style="${styleMap(this.styles.track)}"
          stroke-dasharray="${this.arc.scaleDasharray} ${this.arc.arcLength}"
          stroke-dashoffset="${this.arc.dashOffset}"
          stroke-width="${this.svg.track.width}"
          transform="rotate(${this.svg.rotate.degrees} ${this.svg.rotate.cx} ${this.svg.rotate.cy})"/>

        <circle id="active-track" class="sak-circslider__active" cx="${this.svg.cx}" cy="${this.svg.cy}" r="${this.svg.radius}"
          fill="${this.config.fill || 'rgba(0, 0, 0, 0)'}"
          style="${styleMap(this.styles.active)}"
          stroke-dasharray="${this.dashArray}"
          stroke-dashoffset="${this.arc.dashOffset}"
          stroke-width="${this.svg.active.width}"
          transform="rotate(${this.svg.rotate.degrees} ${this.svg.rotate.cx} ${this.svg.rotate.cy})"/>

        ${renderThumbGroup.call(this)}
        ${renderLabel.call(this, false)}
      </g>

    `;
  }

  /** *****************************************************************************
  * CircularSliderTool::render()
  *
  * Summary.
  * The render() function for this object.
  *
  */
  render() {
    return svg`
      <svg xmlns="http://www.w3.org/2000/svg" id="circslider-${this.toolId}" class="circslider__group-outer" overflow="visible"
        touch-action="none" style="touch-action:none;"
      >
        ${this._renderCircSlider()}

      </svg>
    `;
  }
} // END of class

/**
  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** ***************************************************************************
  * RangeSliderTool::constructor class
  *
  * Summary.
  *
  */

class RangeSliderTool extends BaseTool {
  constructor(argToolset, argConfig, argPos) {
    const DEFAULT_RANGESLIDER_CONFIG = {
      descr: 'none',
      position: {
        cx: 50,
        cy: 50,
        orientation: 'horizontal',
        active: {
          width: 0,
          height: 0,
          radius: 0,
        },
        track: {
          width: 16,
          height: 7,
          radius: 3.5,
        },
        thumb: {
          width: 9,
          height: 9,
          radius: 4.5,
          offset: 4.5,
        },
        label: {
          placement: 'none',
        },
      },
      show: {
        uom: 'end',
        active: false,
      },
      classes: {
        tool: {
          'sak-slider': true,
          hover: true,
        },
        capture: {
          'sak-slider__capture': true,
        },
        active: {
          'sak-slider__active': true,
        },
        track: {
          'sak-slider__track': true,
        },
        thumb: {
          'sak-slider__thumb': true,
        },
        label: {
          'sak-slider__value': true,
        },
        uom: {
          'sak-slider__uom': true,
        },
      },
      styles: {
        tool: {
        },
        capture: {
        },
        active: {
        },
        track: {
        },
        thumb: {
        },
        label: {
        },
        uom: {
        },
      },
    };

    super(argToolset, Merge.mergeDeep(DEFAULT_RANGESLIDER_CONFIG, argConfig), argPos);

    this.svg.activeTrack = {};
    this.svg.activeTrack.radius = Utils.calculateSvgDimension(this.config.position.active.radius);
    this.svg.activeTrack.height = Utils.calculateSvgDimension(this.config.position.active.height);
    this.svg.activeTrack.width = Utils.calculateSvgDimension(this.config.position.active.width);

    this.svg.track = {};
    this.svg.track.radius = Utils.calculateSvgDimension(this.config.position.track.radius);

    this.svg.thumb = {};
    this.svg.thumb.radius = Utils.calculateSvgDimension(this.config.position.thumb.radius);
    this.svg.thumb.offset = Utils.calculateSvgDimension(this.config.position.thumb.offset);

    this.svg.capture = {};

    this.svg.label = {};

    switch (this.config.position.orientation) {
      case 'horizontal':
      case 'vertical':
        this.svg.capture.width = Utils.calculateSvgDimension(this.config.position.capture.width || 1.1 * this.config.position.track.width);
        this.svg.capture.height = Utils.calculateSvgDimension(this.config.position.capture.height || 3 * this.config.position.thumb.height);

        this.svg.track.width = Utils.calculateSvgDimension(this.config.position.track.width);
        this.svg.track.height = Utils.calculateSvgDimension(this.config.position.track.height);

        this.svg.thumb.width = Utils.calculateSvgDimension(this.config.position.thumb.width);
        this.svg.thumb.height = Utils.calculateSvgDimension(this.config.position.thumb.height);

        // x1, y1 = topleft corner
        this.svg.capture.x1 = this.svg.cx - this.svg.capture.width / 2;
        this.svg.capture.y1 = this.svg.cy - this.svg.capture.height / 2;

        // x1, y1 = topleft corner
        this.svg.track.x1 = this.svg.cx - this.svg.track.width / 2;
        this.svg.track.y1 = this.svg.cy - this.svg.track.height / 2;

        // x1, y1 = topleft corner
        this.svg.activeTrack.x1 = (this.config.position.orientation == 'horizontal') ? this.svg.track.x1 : this.svg.cx - this.svg.activeTrack.width / 2;
        this.svg.activeTrack.y1 = this.svg.cy - this.svg.activeTrack.height / 2;
        // this.svg.activeTrack.x1 = this.svg.track.x1;

        this.svg.thumb.x1 = this.svg.cx - this.svg.thumb.width / 2;
        this.svg.thumb.y1 = this.svg.cy - this.svg.thumb.height / 2;
        break;

      default:
        console.error('RangeSliderTool - constructor: invalid orientation [vertical, horizontal] = ', this.config.position.orientation);
        throw Error('RangeSliderTool::constructor - invalid orientation [vertical, horizontal] = ', this.config.position.orientation);
    }

    switch (this.config.position.orientation) {
      case 'vertical':
        this.svg.track.y2 = this.svg.cy + this.svg.track.height / 2;
        this.svg.activeTrack.y2 = this.svg.track.y2;
        break;
    }
    switch (this.config.position.label.placement) {
      case 'position':
        this.svg.label.cx = Utils.calculateSvgCoordinate(this.config.position.label.cx, 0);
        this.svg.label.cy = Utils.calculateSvgCoordinate(this.config.position.label.cy, 0);
        break;

      case 'thumb':
        this.svg.label.cx = this.svg.cx;
        this.svg.label.cy = this.svg.cy;
        break;

      case 'none':
        break;

      default:
        console.error('RangeSliderTool - constructor: invalid label placement [none, position, thumb] = ', this.config.position.label.placement);
        throw Error('RangeSliderTool::constructor - invalid label placement [none, position, thumb] = ', this.config.position.label.placement);
    }

    // Init classes
    this.classes.capture = {};
    this.classes.track = {};
    this.classes.thumb = {};
    this.classes.label = {};
    this.classes.uom = {};

    // Init styles
    this.styles.capture = {};
    this.styles.track = {};
    this.styles.thumb = {};
    this.styles.label = {};
    this.styles.uom = {};

    // Init scale
    this.svg.scale = {};
    this.svg.scale.min = this.valueToSvg(this, this.config.scale.min);
    this.svg.scale.max = this.valueToSvg(this, this.config.scale.max);
    this.svg.scale.step = this.config.scale.step;

    if (this.dev.debug) console.log('RangeSliderTool constructor coords, dimensions', this.coords, this.dimensions, this.svg, this.config);
  }

  /** *****************************************************************************
  * RangeSliderTool::svgCoordinateToSliderValue()
  *
  * Summary.
  * @returns {slider value} Translated svg coordinate to actual slider value
  *
  */

  svgCoordinateToSliderValue(argThis, m) {
    let state;
    let scalePos;

    switch (argThis.config.position.orientation) {
      case 'horizontal':
        var xpos = m.x - argThis.svg.track.x1 - this.svg.thumb.width / 2;
        scalePos = xpos / (argThis.svg.track.width - this.svg.thumb.width);
        break;

      case 'vertical':
        // y is calculated from lower y value. So slider is from bottom to top...
        var ypos = argThis.svg.track.y2 - this.svg.thumb.height / 2 - m.y;
        scalePos = ypos / (argThis.svg.track.height - this.svg.thumb.height);
        break;
    }
    state = ((argThis.config.scale.max - argThis.config.scale.min) * scalePos) + argThis.config.scale.min;
    state = Math.round(state / this.svg.scale.step) * this.svg.scale.step;
    state = Math.max(Math.min(this.config.scale.max, state), this.config.scale.min);

    return state;
  }

  valueToSvg(argThis, argValue) {
    if (argThis.config.position.orientation == 'horizontal') {
      const state = Utils.calculateValueBetween(argThis.config.scale.min, argThis.config.scale.max, argValue);

      const xposp = state * (argThis.svg.track.width - this.svg.thumb.width);
      const xpos = argThis.svg.track.x1 + this.svg.thumb.width / 2 + xposp;
      return xpos;
    } else if (argThis.config.position.orientation == 'vertical') {
      const state = Utils.calculateValueBetween(argThis.config.scale.min, argThis.config.scale.max, argValue);

      const yposp = state * (argThis.svg.track.height - this.svg.thumb.height);
      const ypos = argThis.svg.track.y2 - this.svg.thumb.height / 2 - yposp;
      return ypos;
    }
  }

  updateValue(argThis, m) {
    this._value = this.svgCoordinateToSliderValue(argThis, m);
    // set dist to 0 to cancel animation frame
    const dist = 0;
    // improvement
    if (Math.abs(dist) < 0.01) {
      if (this.rid) {
        window.cancelAnimationFrame(this.rid);
        this.rid = null;
      }
    }
  }

  updateThumb(argThis, m) {
    switch (argThis.config.position.orientation) {
      default:
      case 'horizontal':
        if (this.config.position.label.placement == 'thumb') ;

        if (this.dragging) {
          const yUp = (this.config.position.label.placement == 'thumb') ? -50 : 0;
          const yUpStr = `translate(${m.x - this.svg.cx}px , ${yUp}px)`;

          argThis.elements.thumbGroup.style.transform = yUpStr;
        } else {
          argThis.elements.thumbGroup.style.transform = `translate(${m.x - this.svg.cx}px, ${0}px)`;
        }
        break;

      case 'vertical':
        if (this.dragging) {
          const xUp = (this.config.position.label.placement == 'thumb') ? -50 : 0;
          const xUpStr = `translate(${xUp}px, ${m.y - this.svg.cy}px)`;
          argThis.elements.thumbGroup.style.transform = xUpStr;
        } else {
          argThis.elements.thumbGroup.style.transform = `translate(${0}px, ${m.y - this.svg.cy}px)`;
        }
        break;
    }

    argThis.updateLabel(argThis, m);
  }

  updateActiveTrack(argThis, m) {
    if (!argThis.config.show.active) return;

    switch (argThis.config.position.orientation) {
      default:
      case 'horizontal':
        if (this.dragging) {
          argThis.elements.activeTrack.setAttribute('width', Math.abs(this.svg.activeTrack.x1 - m.x + this.svg.cx));
        }
        break;

      case 'vertical':
        if (this.dragging) {
          argThis.elements.activeTrack.setAttribute('y', m.y - this.svg.cy);
          argThis.elements.activeTrack.setAttribute('height', Math.abs(argThis.svg.activeTrack.y2 - m.y + this.svg.cx));
        }
        break;
    }
  }

  updateLabel(argThis, m) {
    if (this.dev.debug) console.log('SLIDER - updateLabel start', m, argThis.config.position.orientation);

    const dec = (this._card.config.entities[this.defaultEntityIndex()].decimals || 0);
    const x = 10 ** dec;
    argThis.labelValue2 = (Math.round(argThis.svgCoordinateToSliderValue(argThis, m) * x) / x).toFixed(dec);

    if (this.config.position.label.placement != 'none') {
      argThis.elements.label.textContent = argThis.labelValue2;
    }
  }

  /*
  * mouseEventToPoint
  *
  * Translate mouse/touch client window coordinates to SVG window coordinates
  *
  */
  mouseEventToPoint(e) {
    var p = this.elements.svg.createSVGPoint();
    p.x = e.touches ? e.touches[0].clientX : e.clientX;
    p.y = e.touches ? e.touches[0].clientY : e.clientY;
    const ctm = this.elements.svg.getScreenCTM().inverse();
    var p = p.matrixTransform(ctm);
    return p;
  }

  callDragService() {
    if (typeof this.labelValue2 === 'undefined') return;

    if (this.labelValuePrev != this.labelValue2) {
      this.labelValuePrev = this.labelValue2;

      this._processTapEvent(
        this._card,
        this._card._hass,
        this.config,
        this.config.user_actions.tap_action,
        this._card.config.entities[this.defaultEntityIndex()]?.entity,
        this.labelValue2,
      );
    }
    if (this.dragging)
      this.timeOutId = setTimeout(() => this.callDragService(), this.config.user_actions.drag_action.update_interval);
  }

  callTapService() {
    if (typeof this.labelValue2 === 'undefined') return;

    if (this.labelValuePrev != this.labelValue2) {
      this.labelValuePrev = this.labelValue2;

      this._processTapEvent(
        this._card,
        this._card._hass,
        this.config,
        this.config.user_actions?.tap_action,
        this._card.config.entities[this.defaultEntityIndex()]?.entity,
        this.labelValue2,
      );
    }
  }

  firstUpdated(changedProperties) {
    this.labelValue = this._stateValue;

    function Frame2() {
      this.rid = window.requestAnimationFrame(Frame2);
      this.updateValue(this, this.m);
      this.updateThumb(this, this.m);
      this.updateActiveTrack(this, this.m);
    }

    if (this.dev.debug) console.log('slider - firstUpdated');
    this.elements = {};
    this.elements.svg = this._card.shadowRoot.getElementById('rangeslider-'.concat(this.toolId));
    this.elements.capture = this.elements.svg.querySelector('#capture');
    this.elements.track = this.elements.svg.querySelector('#rs-track');
    this.elements.activeTrack = this.elements.svg.querySelector('#active-track');
    this.elements.thumbGroup = this.elements.svg.querySelector('#rs-thumb-group');
    this.elements.thumb = this.elements.svg.querySelector('#rs-thumb');
    this.elements.label = this.elements.svg.querySelector('#rs-label tspan');

    if (this.dev.debug) console.log('slider - firstUpdated svg = ', this.elements.svg, 'path=', this.elements.path, 'thumb=', this.elements.thumb, 'label=', this.elements.label, 'text=', this.elements.text);

    function pointerDown(e) {
      e.preventDefault();

      // @NTS: Keep this comment for later!!
      // Safari: We use mouse stuff for pointerdown, but have to use pointer stuff to make sliding work on Safari. WHY??
      window.addEventListener('pointermove', pointerMove.bind(this), false);
      window.addEventListener('pointerup', pointerUp.bind(this), false);

      // @NTS: Keep this comment for later!!
      // Below lines prevent slider working on Safari...
      //
      // window.addEventListener('mousemove', pointerMove.bind(this), false);
      // window.addEventListener('touchmove', pointerMove.bind(this), false);
      // window.addEventListener('mouseup', pointerUp.bind(this), false);
      // window.addEventListener('touchend', pointerUp.bind(this), false);

      const mousePos = this.mouseEventToPoint(e);
      const thumbPos = (this.svg.thumb.x1 + this.svg.thumb.cx);
      if ((mousePos.x > (thumbPos - 10)) && (mousePos.x < (thumbPos + this.svg.thumb.width + 10))) {
        ne(window, 'haptic', 'heavy');
      } else {
        ne(window, 'haptic', 'error');
        return;
      }

      // User is dragging the thumb of the slider!
      this.dragging = true;

      // Check for drag_action. If none specified, or update_interval = 0, don't update while dragging...

      if ((this.config.user_actions?.drag_action) && (this.config.user_actions?.drag_action.update_interval)) {
        if (this.config.user_actions.drag_action.update_interval > 0) {
          this.timeOutId = setTimeout(() => this.callDragService(), this.config.user_actions.drag_action.update_interval);
        } else {
          this.timeOutId = null;
        }
      }
      this.m = this.mouseEventToPoint(e);

      if (this.config.position.orientation == 'horizontal') {
        this.m.x = (Math.round(this.m.x / this.svg.scale.step) * this.svg.scale.step);
      } else {
        this.m.y = (Math.round(this.m.y / this.svg.scale.step) * this.svg.scale.step);
      }
      if (this.dev.debug) console.log('pointerDOWN', Math.round(this.m.x * 100) / 100);
      Frame2.call(this);
    }

    function pointerUp(e) {
      e.preventDefault();

      // @NTS: Keep this comment for later!!
      // Safari: Fixes unable to grab pointer
      window.removeEventListener('pointermove', pointerMove.bind(this), false);
      window.removeEventListener('pointerup', pointerUp.bind(this), false);

      window.removeEventListener('mousemove', pointerMove.bind(this), false);
      window.removeEventListener('touchmove', pointerMove.bind(this), false);
      window.removeEventListener('mouseup', pointerUp.bind(this), false);
      window.removeEventListener('touchend', pointerUp.bind(this), false);

      if (!this.dragging) return;

      this.dragging = false;
      clearTimeout(this.timeOutId);
      this.target = 0;
      if (this.dev.debug) console.log('pointerUP');
      Frame2.call(this);
      this.callTapService();
    }

    function pointerMove(e) {
      let scaleValue;

      e.preventDefault();

      if (this.dragging) {
        this.m = this.mouseEventToPoint(e);

        switch (this.config.position.orientation) {
          case 'horizontal':
            scaleValue = this.svgCoordinateToSliderValue(this, this.m);
            this.m.x = this.valueToSvg(this, scaleValue);
            this.m.x = Math.max(this.svg.scale.min, Math.min(this.m.x, this.svg.scale.max));
            this.m.x = (Math.round(this.m.x / this.svg.scale.step) * this.svg.scale.step);
            break;

          case 'vertical':
            scaleValue = this.svgCoordinateToSliderValue(this, this.m);
            this.m.y = this.valueToSvg(this, scaleValue);
            this.m.y = (Math.round(this.m.y / this.svg.scale.step) * this.svg.scale.step);
            break;
        }
        Frame2.call(this);
      }
    }

    // @NTS: Keep this comment for later!!
    // For things to work in Safari, we need separate touch and mouse down handlers...
    // DON't as WHY! The pointerdown method prevents listening on window events later on.
    // ie, we can't move our finger

    // this.elements.svg.addEventListener("pointerdown", pointerDown.bind(this), false);

    this.elements.svg.addEventListener('touchstart', pointerDown.bind(this), false);
    this.elements.svg.addEventListener('mousedown', pointerDown.bind(this), false);
  }

  /** *****************************************************************************
  * RangeSliderTool::value()
  *
  * Summary.
  * Receive new state data for the entity this rangeslider is linked to. Called from set hass;
  * Sets the brightness value of the slider. This is a value 0..255. We display %, so translate
  *
  */
  set value(state) {
    const changed = super.value = state;
    if (!this.dragging) this.labelValue = this._stateValue;
    return changed;
  }

  _renderUom() {
    if (this.config.show.uom === 'none') {
      return svg``;
    } else {
      this.MergeAnimationStyleIfChanged();
      this.MergeColorFromState(this.styles.uom);

      let fsuomStr = this.styles.label['font-size'];

      let fsuomValue = 0.5;
      let fsuomType = 'em';
      const fsuomSplit = fsuomStr.match(/\D+|\d*\.?\d+/g);
      if (fsuomSplit.length == 2) {
        fsuomValue = Number(fsuomSplit[0]) * 0.6;
        fsuomType = fsuomSplit[1];
      } else console.error('Cannot determine font-size for state/unit', fsuomStr);

      fsuomStr = { 'font-size': fsuomValue + fsuomType };

      this.styles.uom = Merge.mergeDeep(this.config.styles.uom, fsuomStr);

      const uom = this._card._buildUom(this.derivedEntity, this._card.entities[this.defaultEntityIndex()], this._card.config.entities[this.defaultEntityIndex()]);

      // Check for location of uom. end = next to state, bottom = below state ;-), etc.
      if (this.config.show.uom === 'end') {
        return svg`
          <tspan class="${classMap(this.classes.uom)}" dx="-0.1em" dy="-0.35em"
            style="${styleMap(this.styles.uom)}">
            ${uom}</tspan>
        `;
      } else if (this.config.show.uom === 'bottom') {
        return svg`
          <tspan class="${classMap(this.classes.uom)}" x="${this.svg.label.cx}" dy="1.5em"
            style="${styleMap(this.styles.uom)}">
            ${uom}</tspan>
        `;
      } else if (this.config.show.uom === 'top') {
        return svg`
          <tspan class="${classMap(this.classes.uom)}" x="${this.svg.label.cx}" dy="-1.5em"
            style="${styleMap(this.styles.uom)}">
            ${uom}</tspan>
        `;
      } else {
        return svg`
          <tspan class="${classMap(this.classes.uom)}"  dx="-0.1em" dy="-0.35em"
            style="${styleMap(this.styles.uom)}">
            ERRR</tspan>
        `;
      }
    }
  }

  /** *****************************************************************************
  * RangeSliderTool::_renderRangeSlider()
  *
  * Summary.
  * Renders the range slider
  *
  */

  _renderRangeSlider() {
    if (this.dev.debug) console.log('slider - _renderRangeSlider');

    this.MergeAnimationClassIfChanged();
    // this.MergeColorFromState(this.styles);
    // this.MergeAnimationStyleIfChanged(this.styles);
    // this.MergeColorFromState(this.styles);

    this.MergeColorFromState();
    this.MergeAnimationStyleIfChanged();
    this.MergeColorFromState();

    // this.MergeAnimationStyleIfChanged();
    // console.log("renderRangeSlider, styles", this.styles);

    this.renderValue = this._stateValue;
    if (this.dragging) {
      this.renderValue = this.labelValue2;
    } else if (this.elements?.label) this.elements.label.textContent = this.renderValue;

    // Calculate cx and cy: the relative move of the thumb from the center of the track
    let cx; let
      cy;
    switch (this.config.position.label.placement) {
      case 'none':
        this.styles.label.display = 'none';
        this.styles.uom.display = 'none';
        break;
      case 'position':
        cx = (this.config.position.orientation == 'horizontal'
          ? this.valueToSvg(this, Number(this.renderValue)) - this.svg.cx
          : 0);
        cy = (this.config.position.orientation == 'vertical'
          ? this.valueToSvg(this, Number(this.renderValue)) - this.svg.cy
          : 0);
        break;

      case 'thumb':
        cx = (this.config.position.orientation == 'horizontal'
          ? -this.svg.label.cx + this.valueToSvg(this, Number(this.renderValue))
          : 0);
        cy = (this.config.position.orientation == 'vertical'
          ? this.valueToSvg(this, Number(this.renderValue))
          : 0);
        if (this.dragging) (this.config.position.orientation == 'horizontal') ? cy -= 50 : cx -= 50;
        break;

      default:
        console.error('_renderRangeSlider(), invalid label placement', this.config.position.label.placement);
    }
    this.svg.thumb.cx = cx;
    this.svg.thumb.cy = cy;

    function renderActiveTrack() {
      if (!this.config.show.active) return svg``;

      if (this.config.position.orientation === 'horizontal') {
        return svg`
          <rect id="active-track" class="${classMap(this.classes.active)}" x="${this.svg.activeTrack.x1}" y="${this.svg.activeTrack.y1}"
            width="${Math.abs(this.svg.thumb.x1 - this.svg.activeTrack.x1 + cx + this.svg.thumb.width / 2)}" height="${this.svg.activeTrack.height}" rx="${this.svg.activeTrack.radius}"
            style="${styleMap(this.styles.active)}" touch-action="none"
          />`;
      } else {
        return svg`
          <rect id="active-track" class="${classMap(this.classes.active)}" x="${this.svg.activeTrack.x1}" y="${cy}"
            height="${Math.abs(this.svg.activeTrack.y1 + cy - this.svg.thumb.height)}" width="${this.svg.activeTrack.width}" rx="${this.svg.activeTrack.radius}"
            style="${styleMap(this.styles.active)}"
          />`;
      }
    }

    function renderThumbGroup() {
      return svg`
        <g id="rs-thumb-group" x="${this.svg.thumb.x1}" y="${this.svg.thumb.y1}" style="transform:translate(${cx}px, ${cy}px);">
          <g style="transform-origin:center;transform-box: fill-box;">
            <rect id="rs-thumb" class="${classMap(this.classes.thumb)}" x="${this.svg.thumb.x1}" y="${this.svg.thumb.y1}"
              width="${this.svg.thumb.width}" height="${this.svg.thumb.height}" rx="${this.svg.thumb.radius}" 
              style="${styleMap(this.styles.thumb)}"
            />
            </g>
            ${renderLabel.call(this, true)} 
        </g>
      `;
    }

    function renderLabel(argGroup) {
      if ((this.config.position.label.placement == 'thumb') && argGroup) {
        return svg`
      <text id="rs-label">
        <tspan class="${classMap(this.classes.label)}" x="${this.svg.label.cx}" y="${this.svg.label.cy}" style="${styleMap(this.styles.label)}">
        ${this.renderValue}</tspan>
        ${this._renderUom()}
        </text>
        `;
      }

      if ((this.config.position.label.placement == 'position') && !argGroup) {
        return svg`
          <text id="rs-label" style="transform-origin:center;transform-box: fill-box;">
            <tspan class="${classMap(this.classes.label)}" data-placement="position" x="${this.svg.label.cx}" y="${this.svg.label.cy}"
            style="${styleMap(this.styles.label)}">${this.renderValue ? this.renderValue : ''}</tspan>
            ${this.renderValue ? this._renderUom() : ''}
          </text>
          `;
      }
    }

    const svgItems = [];
    svgItems.push(svg`
      <rect id="capture" class="${classMap(this.classes.capture)}" x="${this.svg.capture.x1}" y="${this.svg.capture.y1}"
      width="${this.svg.capture.width}" height="${this.svg.capture.height}" rx="${this.svg.track.radius}"          
      />

      <rect id="rs-track" class="${classMap(this.classes.track)}" x="${this.svg.track.x1}" y="${this.svg.track.y1}"
        width="${this.svg.track.width}" height="${this.svg.track.height}" rx="${this.svg.track.radius}"
        style="${styleMap(this.styles.track)}"
      />

      ${renderActiveTrack.call(this)}
      ${renderThumbGroup.call(this)}
      ${renderLabel.call(this, false)}


      `);

    return svgItems;
  }

  /** *****************************************************************************
  * RangeSliderTool::render()
  *
  * Summary.
  * The render() function for this object. The conversion of pointer events need
  * an SVG as grouping object!
  *
  * NOTE:
  * It is imperative that the style overflow=visible is set on the svg.
  * The weird thing is that if using an svg as grouping object, AND a class, the overflow=visible
  * seems to be ignored by both chrome and safari. If the overflow=visible is directly set as style,
  * the setting works.
  *
  * Works on svg with direct styling:
  * ---
  *  return svg`
  *    <svg xmlns="http://www.w3.org/2000/svg" id="rangeslider-${this.toolId}"
  *      pointer-events="all" overflow="visible"
  *    >
  *      ${this._renderRangeSlider()}
  *    </svg>
  *  `;
  *
  * Does NOT work on svg with class styling:
  * ---
  *  return svg`
  *    <svg xmlns="http://www.w3.org/2000/svg" id="rangeslider-${this.toolId}" class="${classMap(this.classes.tool)}"
  *    >
  *      ${this._renderRangeSlider()}
  *    </svg>
  *  `;
  * where the class has the overflow=visible setting...
  *
  */
  render() {
    return svg`
      <svg xmlns="http://www.w3.org/2000/svg" id="rangeslider-${this.toolId}" overflow="visible"
        touch-action="none" style="touch-action:none; pointer-events:none;"
      >
        ${this._renderRangeSlider()}
      </svg>
    `;
  }
} // END of class

/**
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** ****************************************************************************
  * LineTool class
  *
  * Summary.
  *
  */

class LineTool extends BaseTool {
  constructor(argToolset, argConfig, argPos) {
    const DEFAULT_LINE_CONFIG = {
      position: {
        orientation: 'vertical',
        length: '10',
        cx: '50',
        cy: '50',
      },
      classes: {
        tool: {
          'sak-line': true,
          hover: true,
        },
        line: {
          'sak-line__line': true,
        },
      },
      styles: {
        tool: {
        },
        line: {
        },
      },
    };

    super(argToolset, Merge.mergeDeep(DEFAULT_LINE_CONFIG, argConfig), argPos);

    if (!['horizontal', 'vertical', 'fromto'].includes(this.config.position.orientation))
      throw Error('LineTool::constructor - invalid orientation [vertical, horizontal, fromto] = ', this.config.position.orientation);

    if (['horizontal', 'vertical'].includes(this.config.position.orientation))
      this.svg.length = Utils.calculateSvgDimension(argConfig.position.length);

    if (this.config.position.orientation == 'fromto') {
      this.svg.x1 = Utils.calculateSvgCoordinate(argConfig.position.x1, this.toolsetPos.cx);
      this.svg.y1 = Utils.calculateSvgCoordinate(argConfig.position.y1, this.toolsetPos.cy);
      this.svg.x2 = Utils.calculateSvgCoordinate(argConfig.position.x2, this.toolsetPos.cx);
      this.svg.y2 = Utils.calculateSvgCoordinate(argConfig.position.y2, this.toolsetPos.cy);
    }

    if (this.config.position.orientation == 'vertical') {
      this.svg.x1 = this.svg.cx;
      this.svg.y1 = this.svg.cy - this.svg.length / 2;
      this.svg.x2 = this.svg.cx;
      this.svg.y2 = this.svg.cy + this.svg.length / 2;
    } else if (this.config.position.orientation == 'horizontal') {
      this.svg.x1 = this.svg.cx - this.svg.length / 2;
      this.svg.y1 = this.svg.cy;
      this.svg.x2 = this.svg.cx + this.svg.length / 2;
      this.svg.y2 = this.svg.cy;
    } else if (this.config.position.orientation == 'fromto') ;

    this.classes.line = {};
    this.styles.line = {};

    if (this.dev.debug) console.log('LineTool constructor coords, dimensions', this.coords, this.dimensions, this.svg, this.config);
  }

  /** *****************************************************************************
  * LineTool::_renderLine()
  *
  * Summary.
  * Renders the line using precalculated coordinates and dimensions.
  * Only the runtime style is calculated before rendering the line
  *
  * @returns  {svg} Rendered line
  *
  */

  _renderLine() {
    this.MergeAnimationClassIfChanged();
    this.MergeAnimationStyleIfChanged();
    this.MergeColorFromState(this.styles.line);

    if (this.dev.debug) console.log('_renderLine', this.config.position.orientation, this.svg.x1, this.svg.y1, this.svg.x2, this.svg.y2);
    return svg`
      <line class="${classMap(this.classes.line)}"
        x1="${this.svg.x1}"
        y1="${this.svg.y1}"
        x2="${this.svg.x2}"
        y2="${this.svg.y2}"
        style="${styleMap(this.styles.line)}"/>
      `;
  }

  /** *****************************************************************************
  * LineTool::render()
  *
  * Summary.
  * The render() function for this object.
  *
  * @returns  {svg} Rendered line group
  *
  */
  render() {
    return svg`
      <g id="line-${this.toolId}" class="${classMap(this.classes.tool)}" style="${styleMap(this.styles.tool)}"
        @click=${(e) => this.handleTapEvent(e, this.config)}>
        ${this._renderLine()}
      </g>
    `;
  }
} // END of class

/**
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** ****************************************************************************
  * CircleTool class
  *
  * Summary.
  *
  */

class CircleTool extends BaseTool {
  constructor(argToolset, argConfig, argPos) {
    const DEFAULT_CIRCLE_CONFIG = {
      position: {
        cx: 50,
        cy: 50,
        radius: 50,
      },
      classes: {
        tool: {
          'sak-circle': true,
          hover: true,
        },
        circle: {
          'sak-circle__circle': true,
        },
      },
      styles: {
        tool: {
        },
        circle: {
        },
      },
    };

    super(argToolset, Merge.mergeDeep(DEFAULT_CIRCLE_CONFIG, argConfig), argPos);
    this.EnableHoverForInteraction();

    this.svg.radius = Utils.calculateSvgDimension(argConfig.position.radius);

    this.classes.circle = {};
    this.styles.circle = {};
    if (this.dev.debug) console.log('CircleTool constructor config, svg', this.toolId, this.config, this.svg);
  }

  /** *****************************************************************************
  * CircleTool::value()
  *
  * Summary.
  * Receive new state data for the entity this circle is linked to. Called from set hass;
  *
  */
  set value(state) {
    const changed = super.value = state;

    return changed;
  }

  /** *****************************************************************************
  * CircleTool::_renderCircle()
  *
  * Summary.
  * Renders the circle using precalculated coordinates and dimensions.
  * Only the runtime style is calculated before rendering the circle
  *
  */

  _renderCircle() {
    this.MergeAnimationClassIfChanged();
    this.MergeAnimationStyleIfChanged();
    this.MergeColorFromState(this.styles.circle);

    return svg`
      <circle class="${classMap(this.classes.circle)}"
        cx="${this.svg.cx}"% cy="${this.svg.cy}"% r="${this.svg.radius}"
        style="${styleMap(this.styles.circle)}"
      </circle>

      `;
  }

  /** *****************************************************************************
  * CircleTool::render()
  *
  * Summary.
  * The render() function for this object.
  *
  */

  render() {
    return svg`
      <g "" id="circle-${this.toolId}" class="${classMap(this.classes.tool)}" overflow="visible" transform-origin="${this.svg.cx} ${this.svg.cy}"
        @click=${(e) => this.handleTapEvent(e, this.config)}>
        ${this._renderCircle()}
      </g>
    `;
  }
} // END of class

/**
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** ****************************************************************************
  * SwitchTool class
  *
  * Summary.
  *
  *
  * NTS:
  * - .mdc-switch__native-control uses:
  *     - width: 68px, 17em
  *     - height: 48px, 12em
  * - and if checked (.mdc-switch--checked):
  *     - transform: translateX(-20px)
  *
  * .mdc-switch.mdc-switch--checked .mdc-switch__thumb {
  *  background-color: var(--switch-checked-button-color);
  *  border-color: var(--switch-checked-button-color);
  *
  */

class SwitchTool extends BaseTool {
  constructor(argToolset, argConfig, argPos) {
    const DEFAULT_SWITCH_CONFIG = {
      position: {
        cx: 50,
        cy: 50,
        orientation: 'horizontal',
        track: {
          width: 16,
          height: 7,
          radius: 3.5,
        },
        thumb: {
          width: 9,
          height: 9,
          radius: 4.5,
          offset: 4.5,
        },
      },
      classes: {
        tool: {
          'sak-switch': true,
          hover: true,
        },
        track: {
          'sak-switch__track': true,
        },
        thumb: {
          'sak-switch__thumb': true,
        },
      },
      styles: {
        tool: {
        },
        track: {
        },
        thumb: {
        },
      },
    };

    const HORIZONTAL_SWITCH_CONFIG = {
      animations: [
        {
          state: 'on',
          id: 1,
          styles: {
            track: {
              fill: 'var(--switch-checked-track-color)',
              'pointer-events': 'auto',
            },
            thumb: {
              fill: 'var(--switch-checked-button-color)',
              transform: 'translateX(4.5em)',
              'pointer-events': 'auto',
            },
          },
        },
        {
          state: 'off',
          id: 0,
          styles: {
            track: {
              fill: 'var(--switch-unchecked-track-color)',
              'pointer-events': 'auto',
            },
            thumb: {
              fill: 'var(--switch-unchecked-button-color)',
              transform: 'translateX(-4.5em)',
              'pointer-events': 'auto',
            },
          },
        },
      ],
    };

    const VERTICAL_SWITCH_CONFIG = {
      animations: [
        {
          state: 'on',
          id: 1,
          styles: {
            track: {
              fill: 'var(--switch-checked-track-color)',
              'pointer-events': 'auto',
            },
            thumb: {
              fill: 'var(--switch-checked-button-color)',
              transform: 'translateY(-4.5em)',
              'pointer-events': 'auto',
            },
          },
        },
        {
          state: 'off',
          id: 0,
          styles: {
            track: {
              fill: 'var(--switch-unchecked-track-color)',
              'pointer-events': 'auto',
            },
            thumb: {
              fill: 'var(--switch-unchecked-button-color)',
              transform: 'translateY(4.5em)',
              'pointer-events': 'auto',
            },
          },
        },
      ],
    };

    super(argToolset, Merge.mergeDeep(DEFAULT_SWITCH_CONFIG, argConfig), argPos);

    if (!['horizontal', 'vertical'].includes(this.config.position.orientation))
      throw Error('SwitchTool::constructor - invalid orientation [vertical, horizontal] = ', this.config.position.orientation);

    this.svg.track = {};
    this.svg.track.radius = Utils.calculateSvgDimension(this.config.position.track.radius);

    this.svg.thumb = {};
    this.svg.thumb.radius = Utils.calculateSvgDimension(this.config.position.thumb.radius);
    this.svg.thumb.offset = Utils.calculateSvgDimension(this.config.position.thumb.offset);

    switch (this.config.position.orientation) {
      default:
      case 'horizontal':
        this.config = Merge.mergeDeep(DEFAULT_SWITCH_CONFIG, HORIZONTAL_SWITCH_CONFIG, argConfig);

        this.svg.track.width = Utils.calculateSvgDimension(this.config.position.track.width);
        this.svg.track.height = Utils.calculateSvgDimension(this.config.position.track.height);
        this.svg.thumb.width = Utils.calculateSvgDimension(this.config.position.thumb.width);
        this.svg.thumb.height = Utils.calculateSvgDimension(this.config.position.thumb.height);

        this.svg.track.x1 = this.svg.cx - this.svg.track.width / 2;
        this.svg.track.y1 = this.svg.cy - this.svg.track.height / 2;

        this.svg.thumb.x1 = this.svg.cx - this.svg.thumb.width / 2;
        this.svg.thumb.y1 = this.svg.cy - this.svg.thumb.height / 2;
        break;

      case 'vertical':
        this.config = Merge.mergeDeep(DEFAULT_SWITCH_CONFIG, VERTICAL_SWITCH_CONFIG, argConfig);

        this.svg.track.width = Utils.calculateSvgDimension(this.config.position.track.height);
        this.svg.track.height = Utils.calculateSvgDimension(this.config.position.track.width);
        this.svg.thumb.width = Utils.calculateSvgDimension(this.config.position.thumb.height);
        this.svg.thumb.height = Utils.calculateSvgDimension(this.config.position.thumb.width);

        this.svg.track.x1 = this.svg.cx - this.svg.track.width / 2;
        this.svg.track.y1 = this.svg.cy - this.svg.track.height / 2;

        this.svg.thumb.x1 = this.svg.cx - this.svg.thumb.width / 2;
        this.svg.thumb.y1 = this.svg.cy - this.svg.thumb.height / 2;
        break;
    }

    this.classes.track = {};
    this.classes.thumb = {};

    this.styles.track = {};
    this.styles.thumb = {};
    if (this.dev.debug) console.log('SwitchTool constructor config, svg', this.toolId, this.config, this.svg);
  }

  /** *****************************************************************************
  * SwitchTool::value()
  *
  * Summary.
  * Receive new state data for the entity this switch is linked to. Called from set hass;
  *
  */
  set value(state) {
    const changed = super.value = state;

    return changed;
  }

  /**
  * SwitchTool::_renderSwitch()
  *
  * Summary.
  * Renders the switch using precalculated coordinates and dimensions.
  * Only the runtime style is calculated before rendering the switch
  *
  */

  _renderSwitch() {
    this.MergeAnimationClassIfChanged();
    // this.MergeColorFromState(this.styles);
    this.MergeAnimationStyleIfChanged(this.styles);
    // this.MergeAnimationStyleIfChanged(this.styles.thumb);

    return svg`
      <g>
        <rect class="${classMap(this.classes.track)}" x="${this.svg.track.x1}" y="${this.svg.track.y1}"
          width="${this.svg.track.width}" height="${this.svg.track.height}" rx="${this.svg.track.radius}"
          style="${styleMap(this.styles.track)}"
        />
        <rect class="${classMap(this.classes.thumb)}" x="${this.svg.thumb.x1}" y="${this.svg.thumb.y1}"
          width="${this.svg.thumb.width}" height="${this.svg.thumb.height}" rx="${this.svg.thumb.radius}" 
          style="${styleMap(this.styles.thumb)}"
        />
      </g>
      `;
  }

  /** *****************************************************************************
  * SwitchTool::render()
  *
  * Summary.
  * The render() function for this object.
  *
  * https://codepen.io/joegaffey/pen/vrVZaN
  *
  */

  render() {
    return svg`
      <g id="switch-${this.toolId}" class="${classMap(this.classes.tool)}" overflow="visible" transform-origin="${this.svg.cx} ${this.svg.cy}"
        @click=${(e) => this.handleTapEvent(e, this.config)}>
        ${this._renderSwitch()}
      </g>
    `;
  }
} // END of class

/**
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** ****************************************************************************
  * RegPolyTool class
  *
  * Summary.
  *
  */

class RegPolyTool extends BaseTool {
  constructor(argToolset, argConfig, argPos) {
    const DEFAULT_REGPOLY_CONFIG = {
      position: {
        cx: 50,
        cy: 50,
        radius: 50,
        side_count: 6,
        side_skip: 1,
        angle_offset: 0,
      },
      classes: {
        tool: {
          'sak-polygon': true,
          hover: true,
        },
        regpoly: {
          'sak-polygon__regpoly': true,
        },
      },
      styles: {
        tool: {
        },
        regpoly: {
        },
      },
    };

    super(argToolset, Merge.mergeDeep(DEFAULT_REGPOLY_CONFIG, argConfig), argPos);

    this.svg.radius = Utils.calculateSvgDimension(argConfig.position.radius);

    this.classes.regpoly = {};
    this.styles.regpoly = {};
    if (this.dev.debug) console.log('RegPolyTool constructor config, svg', this.toolId, this.config, this.svg);
  }

  /** *****************************************************************************
  * RegPolyTool::value()
  *
  * Summary.
  * Receive new state data for the entity this circle is linked to. Called from set hass;
  *
  */
  set value(state) {
    const changed = super.value = state;

    return changed;
  }

  /** *****************************************************************************
  * RegPolyTool::_renderRegPoly()
  *
  * Summary.
  * Renders the regular polygon using precalculated coordinates and dimensions.
  * Only the runtime style is calculated before rendering the regular polygon
  *
  */

  _renderRegPoly() {
    const generatePoly = function (p, q, r, a, cx, cy) {
      const base_angle = 2 * Math.PI / p;
      let angle = a + base_angle;
      let x; let y; let
        d_attr = '';

      for (let i = 0; i < p; i++) {
        angle += q * base_angle;

        x = cx + ~~(r * Math.cos(angle));
        y = cy + ~~(r * Math.sin(angle));

        d_attr
          += `${((i === 0) ? 'M' : 'L') + x} ${y} `;

        if (i * q % p === 0 && i > 0) {
          angle += base_angle;
          x = cx + ~~(r * Math.cos(angle));
          y = cy + ~~(r * Math.sin(angle));

          d_attr += `M${x} ${y} `;
        }
      }

      d_attr += 'z';
      return d_attr;
    };

    this.MergeAnimationStyleIfChanged();
    this.MergeColorFromState(this.styles.regpoly);

    return svg`
      <path class="${classMap(this.classes.regpoly)}"
        d="${generatePoly(this.config.position.side_count, this.config.position.side_skip, this.svg.radius, this.config.position.angle_offset, this.svg.cx, this.svg.cy)}"
        style="${styleMap(this.styles.regpoly)}"
      />
      `;
  }

  /** *****************************************************************************
  * RegPolyTool::render()
  *
  * Summary.
  * The render() function for this object.
  *
  */
  //        @click=${e => this._card.handlePopup(e, this._card.entities[this.defaultEntityIndex()])} >

  render() {
    return svg`
      <g "" id="regpoly-${this.toolId}" class="${classMap(this.classes.tool)}" transform-origin="${this.svg.cx} ${this.svg.cy}"
        @click=${(e) => this.handleTapEvent(e, this.config)}>
        ${this._renderRegPoly()}
      </g>
    `;
  }
} // END of class

/**
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** ****************************************************************************
  * UserSvgTool class, UserSvgTool::constructor
  *
  * Summary.
  *
  */

class UserSvgTool extends BaseTool {
  constructor(argToolset, argConfig, argPos) {
    const DEFAULT_USERSVG_CONFIG = {
      position: {
        cx: 50,
        cy: 50,
        height: 50,
        width: 50,
      },
      styles: {
        usersvg: {
        },
        mask: {
          fill: 'white',
        },
      },
    };

    super(argToolset, Merge.mergeDeep(DEFAULT_USERSVG_CONFIG, argConfig), argPos);

    this.images = {};
    this.images = Object.assign({}, ...this.config.images);

    // #TODO:
    // Select first key in k/v store. HOw??
    this.item = {};
    this.item.image = 'default';

    // https://github.com/flobacher/SVGInjector2
    // Note: in defs, url from gradient is changed, but NOT in the SVG fill=...

    this.injector = {};
    // Options
    this.injector.injectorOptions = {
      evalScripts: 'once',
      pngFallback: 'assets/png',
    };

    this.injector.afterAllInjectionsFinishedCallback = function (totalSVGsInjected) {
      // Callback after all SVGs are injected
      // console.log('We injected ' + totalSVGsInjected + ' SVG(s)!');
    };

    this.injector.perInjectionCallback = function (svg) {
      // Callback after each SVG is injected
      this.injector.svg = svg;
      // console.log('SVG injected: ', svg, this.injector);
    }.bind(this);

    // create injector configured by options
    //this.injector.injector = new SVGInjector(this.injector.injectorOptions);

    this.clipPath = {};

    if (this.config.clip_path) {
      this.svg.cp_cx = Utils.calculateSvgCoordinate(this.config.clip_path.position.cx || this.config.position.cx, 0);
      this.svg.cp_cy = Utils.calculateSvgCoordinate(this.config.clip_path.position.cy || this.config.position.cy, 0);
      this.svg.cp_height = Utils.calculateSvgDimension(this.config.clip_path.position.height || this.config.position.height);
      this.svg.cp_width = Utils.calculateSvgDimension(this.config.clip_path.position.width || this.config.position.width);

      const maxRadius = Math.min(this.svg.cp_height, this.svg.cp_width) / 2;

      this.svg.radiusTopLeft = +Math.min(maxRadius, Math.max(0, Utils.calculateSvgDimension(
        this.config.clip_path.position.radius.top_left || this.config.clip_path.position.radius.left
                                || this.config.clip_path.position.radius.top || this.config.clip_path.position.radius.all,
      ))) || 0;

      this.svg.radiusTopRight = +Math.min(maxRadius, Math.max(0, Utils.calculateSvgDimension(
        this.config.clip_path.position.radius.top_right || this.config.clip_path.position.radius.right
                                || this.config.clip_path.position.radius.top || this.config.clip_path.position.radius.all,
      ))) || 0;

      this.svg.radiusBottomLeft = +Math.min(maxRadius, Math.max(0, Utils.calculateSvgDimension(
        this.config.clip_path.position.radius.bottom_left || this.config.clip_path.position.radius.left
                                || this.config.clip_path.position.radius.bottom || this.config.clip_path.position.radius.all,
      ))) || 0;

      this.svg.radiusBottomRight = +Math.min(maxRadius, Math.max(0, Utils.calculateSvgDimension(
        this.config.clip_path.position.radius.bottom_right || this.config.clip_path.position.radius.right
                                || this.config.clip_path.position.radius.bottom || this.config.clip_path.position.radius.all,
      ))) || 0;
    }

    if (this.dev.debug) console.log('UserSvgTool constructor config, svg', this.toolId, this.config, this.svg);
  }

  /** *****************************************************************************
  * UserSvgTool::value()
  *
  * Summary.
  * Receive new state data for the entity this usersvg is linked to. Called from set hass;
  *
  */
  set value(state) {
    const changed = super.value = state;

    return changed;
  }

  updated(changedProperties) {
    this.injector.elementsToInject = this._card.shadowRoot.querySelectorAll('svg[data-src]');
    // console.log("updated - ", this._card.shadowRoot.getElementById("usersvg-".concat(this.toolId)), this.injector.elementsToInject);

    this.injector.elementsToInject = this._card.shadowRoot.getElementById('usersvg-'.concat(this.toolId)).querySelectorAll('svg[data-src]:not(.injected-svg)');

    // Trigger the injection if there is something to inject...
    if (this.injector.elementsToInject.length > 0)
      this.injector.injector.inject(
        this.injector.elementsToInject,
        this.injector.afterAllInjectionsFinishedCallback,
        this.injector.perInjectionCallback,
      );
  }

  /** *****************************************************************************
  * UserSvgTool::_renderUserSvg()
  *
  * Summary.
  * Renders the usersvg using precalculated coordinates and dimensions.
  * Only the runtime style is calculated before rendering the usersvg
  *
  */

  _renderUserSvg() {
    this.MergeAnimationStyleIfChanged();

    const images = Templates.getJsTemplateOrValue(this, this._stateValue, Merge.mergeDeep(this.images));

    // if ((this.injector.svg) && (this.injector.image2.trim() === images[this.item.image].trim())) {
    // return svg`${this.injector.svg}`;
    // if (false) {
    // } else {
    if (images[this.item.image] === 'none')
      return svg``;

    let clipPath = '';
    if (this.config.clip_path) {
      clipPath = svg`
        <defs>
          <path  id="path-${this.toolId}"
            d="
              M ${this.svg.cp_cx + this.svg.radiusTopLeft + ((this.svg.width - this.svg.cp_width) / 2)} ${this.svg.cp_cy + ((this.svg.height - this.svg.cp_height) / 2)}
              h ${this.svg.cp_width - this.svg.radiusTopLeft - this.svg.radiusTopRight}
              a ${this.svg.radiusTopRight} ${this.svg.radiusTopRight} 0 0 1 ${this.svg.radiusTopRight} ${this.svg.radiusTopRight}
              v ${this.svg.cp_height - this.svg.radiusTopRight - this.svg.radiusBottomRight}
              a ${this.svg.radiusBottomRight} ${this.svg.radiusBottomRight} 0 0 1 -${this.svg.radiusBottomRight} ${this.svg.radiusBottomRight}
              h -${this.svg.cp_width - this.svg.radiusBottomRight - this.svg.radiusBottomLeft}
              a ${this.svg.radiusBottomLeft} ${this.svg.radiusBottomLeft} 0 0 1 -${this.svg.radiusBottomLeft} -${this.svg.radiusBottomLeft}
              v -${this.svg.cp_height - this.svg.radiusBottomLeft - this.svg.radiusTopLeft}
              a ${this.svg.radiusTopLeft} ${this.svg.radiusTopLeft}  0 0 1 ${this.svg.radiusTopLeft} -${this.svg.radiusTopLeft}
              ">
          </path>
          <clipPath id="clip-path-${this.toolId}">
            <use href="#path-${this.toolId}"/>
          </clipPath>
          <mask id="mask-${this.toolId}">
            <use href="#path-${this.toolId}" style="${styleMap(this.styles.mask)}"/>
          </mask>
        </defs>
        `;
    }

    // If svg, use injector for rendering. If jpg or png, use default image renderer...
    if (['png', 'jpg'].includes((images[this.item.image].substring(images[this.item.image].lastIndexOf('.') + 1)))) {
      // Render jpg or png
      return svg`
        <svg class="sak-usersvg__image" x="${this.svg.x}" y="${this.svg.y}" style="${styleMap(this.styles)}">
          "${clipPath}"
          <image clip-path="url(#clip-path-${this.toolId})" mask="url(#mask-${this.toolId})" href="${images[this.item.image]}" height="${this.svg.height}" width="${this.svg.width}"/>
        </svg>
        `;
    } else {
      return svg`
        <svg class="sak-usersvg__image" data-some="${images[this.item.image]}" x="${this.svg.x}" y="${this.svg.y}" style="${styleMap(this.styles)}">
          "${clipPath}"
          <image clip-path="url(#clip-path-${this.toolId})" mask="url(#mask-${this.toolId})" href="${images[this.item.image]}" height="${this.svg.height}" width="${this.svg.width}"/>
        </svg>
        `;

      // It seems new stuff is NOT injected for some reason. Donno why. Cant find it. Simply NOT injected, although injector is called in updated...
      // 2022.07.24 For now, disable injector stuff...
      // return svg`
      // <svg id="image-one" data-src="${images[this.item.image]}" class="sak-usersvg__image" x="${this.svg.x}" y="${this.svg.y}"
      // style="${styleMap(this.styles.usersvg)}" height="${this.svg.height}" width="${this.svg.width}">
      // </svg>
      // `;
    }
    // }
  }

  /** *****************************************************************************
  * UserSvgTool::render()
  *
  * Summary.
  * The render() function for this object.
  *
  */
  render() {
    return svg`
      <g id="usersvg-${this.toolId}" overflow="visible" transform-origin="${this.svg.cx} ${this.svg.cy}"
        style="${styleMap(this.styles.tool)}"
        @click=${(e) => this.handleTapEvent(e, this.config)}>
        ${this._renderUserSvg()}
      </g>
    `;
  }
} // END of class

/**
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** ****************************************************************************
  * RectangleTool class
  *
  * Summary.
  *
  */

class RectangleTool extends BaseTool {
  constructor(argToolset, argConfig, argPos) {
    const DEFAULT_RECTANGLE_CONFIG = {
      position: {
        cx: 50,
        cy: 50,
        width: 50,
        height: 50,
        rx: 0,
      },
      classes: {
        tool: {
          'sak-rectangle': true,
          hover: true,
        },
        rectangle: {
          'sak-rectangle__rectangle': true,
        },
      },
      styles: {
        rectangle: {
        },
      },
    };

    super(argToolset, Merge.mergeDeep(DEFAULT_RECTANGLE_CONFIG, argConfig), argPos);
    this.svg.rx = argConfig.position.rx ? Utils.calculateSvgDimension(argConfig.position.rx) : 0;

    this.classes.rectangle = {};
    this.styles.rectangle = {};

    if (this.dev.debug) console.log('RectangleTool constructor config, svg', this.toolId, this.config, this.svg);
  }

  /** *****************************************************************************
  * RectangleTool::value()
  *
  * Summary.
  * Receive new state data for the entity this rectangle is linked to. Called from set hass;
  *
  */
  set value(state) {
    const changed = super.value = state;

    return changed;
  }

  /** *****************************************************************************
  * RectangleTool::_renderRectangle()
  *
  * Summary.
  * Renders the circle using precalculated coordinates and dimensions.
  * Only the runtime style is calculated before rendering the circle
  *
  */

  _renderRectangle() {
    this.MergeAnimationClassIfChanged();
    this.MergeAnimationStyleIfChanged();
    this.MergeColorFromState(this.styles.rectangle);

    return svg`
      <rect class="${classMap(this.classes.rectangle)}"
        x="${this.svg.x}" y="${this.svg.y}" width="${this.svg.width}" height="${this.svg.height}" rx="${this.svg.rx}"
        style="${styleMap(this.styles.rectangle)}"/>
      `;
  }

  /** *****************************************************************************
  * RectangleTool::render()
  *
  * Summary.
  * The render() function for this object.
  *
  */
  render() {
    return svg`
      <g id="rectangle-${this.toolId}" class="${classMap(this.classes.tool)}" transform-origin="${this.svg.cx}px ${this.svg.cy}px"
        @click=${(e) => this.handleTapEvent(e, this.config)}>
        ${this._renderRectangle()}
      </g>
    `;
  }
} // END of class

/**
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** ****************************************************************************
  * RectangleToolEx class
  *
  * Summary.
  *
  */

class RectangleToolEx extends BaseTool {
  constructor(argToolset, argConfig, argPos) {
    const DEFAULT_RECTANGLEEX_CONFIG = {
      position: {
        cx: 50,
        cy: 50,
        width: 50,
        height: 50,
        radius: {
          all: 0,
        },
      },
      classes: {
        tool: {
          'sak-rectex': true,
          hover: true,
        },
        rectex: {
          'sak-rectex__rectex': true,
        },
      },
      styles: {
        rectex: {
        },
      },
    };
    super(argToolset, Merge.mergeDeep(DEFAULT_RECTANGLEEX_CONFIG, argConfig), argPos);

    this.classes.rectex = {};
    this.styles.rectex = {};

    // #TODO:
    // Verify max radius, or just let it go, and let the user handle that right value.
    // A q can be max height of rectangle, ie both corners added must be less than the height, but also less then the width...

    const maxRadius = Math.min(this.svg.height, this.svg.width) / 2;
    let radius = 0;
    radius = Utils.calculateSvgDimension(this.config.position.radius.all);
    this.svg.radiusTopLeft = +Math.min(maxRadius, Math.max(0, Utils.calculateSvgDimension(
      this.config.position.radius.top_left || this.config.position.radius.left || this.config.position.radius.top || radius,
    ))) || 0;

    this.svg.radiusTopRight = +Math.min(maxRadius, Math.max(0, Utils.calculateSvgDimension(
      this.config.position.radius.top_right || this.config.position.radius.right || this.config.position.radius.top || radius,
    ))) || 0;

    this.svg.radiusBottomLeft = +Math.min(maxRadius, Math.max(0, Utils.calculateSvgDimension(
      this.config.position.radius.bottom_left || this.config.position.radius.left || this.config.position.radius.bottom || radius,
    ))) || 0;

    this.svg.radiusBottomRight = +Math.min(maxRadius, Math.max(0, Utils.calculateSvgDimension(
      this.config.position.radius.bottom_right || this.config.position.radius.right || this.config.position.radius.bottom || radius,
    ))) || 0;

    if (this.dev.debug) console.log('RectangleToolEx constructor config, svg', this.toolId, this.config, this.svg);
  }

  /** *****************************************************************************
  * RectangleToolEx::value()
  *
  */
  set value(state) {
    const changed = super.value = state;

    return changed;
  }

  /** *****************************************************************************
  * RectangleToolEx::_renderRectangleEx()
  *
  * Summary.
  * Renders the rectangle using lines and bezier curves with precalculated coordinates and dimensions.
  *
  * Refs for creating the path online:
  * - https://mavo.io/demos/svgpath/
  *
  */

  _renderRectangleEx() {
    this.MergeAnimationClassIfChanged();

    // WIP
    this.MergeAnimationStyleIfChanged(this.styles);
    this.MergeAnimationStyleIfChanged();
    if (this.config.hasOwnProperty('csnew')) {
      this.MergeColorFromState2(this.styles.rectex, 'rectex');
    } else {
      this.MergeColorFromState(this.styles.rectex);
    }

    if (!this.counter) { this.counter = 0; }
    this.counter++;

    const svgItems = svg`
      <g class="${classMap(this.classes.rectex)}" id="rectex-${this.toolId}">
        <path  d="
            M ${this.svg.x + this.svg.radiusTopLeft} ${this.svg.y}
            h ${this.svg.width - this.svg.radiusTopLeft - this.svg.radiusTopRight}
            q ${this.svg.radiusTopRight} 0 ${this.svg.radiusTopRight} ${this.svg.radiusTopRight}
            v ${this.svg.height - this.svg.radiusTopRight - this.svg.radiusBottomRight}
            q 0 ${this.svg.radiusBottomRight} -${this.svg.radiusBottomRight} ${this.svg.radiusBottomRight}
            h -${this.svg.width - this.svg.radiusBottomRight - this.svg.radiusBottomLeft}
            q -${this.svg.radiusBottomLeft} 0 -${this.svg.radiusBottomLeft} -${this.svg.radiusBottomLeft}
            v -${this.svg.height - this.svg.radiusBottomLeft - this.svg.radiusTopLeft}
            q 0 -${this.svg.radiusTopLeft} ${this.svg.radiusTopLeft} -${this.svg.radiusTopLeft}
            "
            counter="${this.counter}" 
            style="${styleMap(this.styles.rectex)}"/>
      </g>
      `;
    return svg`${svgItems}`;
  }

  /** *****************************************************************************
  * RectangleToolEx::render()
  *
  * Summary.
  * The render() function for this object.
  *
  */
  render() {
    return svg`
      <g id="rectex-${this.toolId}" class="${classMap(this.classes.tool)}"
        @click=${(e) => this.handleTapEvent(e, this.config)}>
        ${this._renderRectangleEx()}
      </g>
    `;
  }
} // END of class

/**
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** ****************************************************************************
  * EllipseTool class
  *
  * Summary.
  *
  */

class EllipseTool extends BaseTool {
  constructor(argToolset, argConfig, argPos) {
    const DEFAULT_ELLIPSE_CONFIG = {
      position: {
        cx: 50,
        cy: 50,
        radiusx: 50,
        radiusy: 25,
      },
      classes: {
        tool: {
          'sak-ellipse': true,
          hover: true,
        },
        ellipse: {
          'sak-ellipse__ellipse': true,
        },
      },
      styles: {
        ellipse: {
        },
      },
    };

    super(argToolset, Merge.mergeDeep(DEFAULT_ELLIPSE_CONFIG, argConfig), argPos);

    this.svg.radiusx = Utils.calculateSvgDimension(argConfig.position.radiusx);
    this.svg.radiusy = Utils.calculateSvgDimension(argConfig.position.radiusy);

    this.classes.ellipse = {};
    this.styles.ellipse = {};

    if (this.dev.debug) console.log('EllipseTool constructor coords, dimensions', this.coords, this.dimensions, this.svg, this.config);
  }

  /** *****************************************************************************
  * EllipseTool::_renderEllipse()
  *
  * Summary.
  * Renders the ellipse using precalculated coordinates and dimensions.
  * Only the runtime style is calculated before rendering the ellipse
  *
  */

  _renderEllipse() {
    this.MergeAnimationClassIfChanged();
    this.MergeAnimationStyleIfChanged();
    this.MergeColorFromState(this.styles.ellipse);

    if (this.dev.debug) console.log('EllipseTool - renderEllipse', this.svg.cx, this.svg.cy, this.svg.radiusx, this.svg.radiusy);

    return svg`
      <ellipse class="${classMap(this.classes.ellipse)}"
        cx="${this.svg.cx}"% cy="${this.svg.cy}"%
        rx="${this.svg.radiusx}" ry="${this.svg.radiusy}"
        style="${styleMap(this.styles.ellipse)}"/>
      `;
  }

  /** *****************************************************************************
  * EllipseTool::render()
  *
  * Summary.
  * The render() function for this object.
  *
  */
  render() {
    return svg`
      <g id="ellipse-${this.toolId}" class="${classMap(this.classes.tool)}"
        @click=${(e) => this.handleTapEvent(e, this.config)}>
        ${this._renderEllipse()}
      </g>
    `;
  }
} // END of class

/**
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** ****************************************************************************
  * EntityIconTool class
  *
  * Summary.
  *
  */

class EntityIconTool extends BaseTool {
  constructor(argToolset, argConfig, argPos) {
    const DEFAULT_ICON_CONFIG = {
      classes: {
        tool: {
          'sak-icon': true,
          hover: true,
        },
        icon: {
          'sak-icon__icon': true,
        },
      },
      styles: {
        icon: {
        },
      },
    };
    super(argToolset, Merge.mergeDeep(DEFAULT_ICON_CONFIG, argConfig), argPos);

    // from original
    // this.config.entity = this.config.entity ? this.config.entity : 0;

    // get icon size, and calculate the foreignObject position and size. This must match the icon size
    // 1em = FONT_SIZE pixels, so we can calculate the icon size, and x/y positions of the foreignObject
    // the viewport is 200x200, so we can calulate the offset.
    //
    // NOTE:
    // Safari doesn't use the svg viewport for rendering of the foreignObject, but the real clientsize.
    // So positioning an icon doesn't work correctly...

    this.svg.iconSize = this.config.position.icon_size ? this.config.position.icon_size : 3;
    this.svg.iconPixels = this.svg.iconSize * FONT_SIZE;

    const align = this.config.position.align ? this.config.position.align : 'center';
    const adjust = (align == 'center' ? 0.5 : (align == 'start' ? -1 : +1));

    const clientWidth = 400; // testing
    const correction = clientWidth / this._card.viewBox.width;

    this.svg.xpx = this.svg.cx;
    this.svg.ypx = this.svg.cy;

    if (((this._card.isSafari) || (this._card.iOS)) && (!this._card.isSafari16)) {
      this.svg.iconSize = this.svg.iconSize * correction;

      this.svg.xpx = (this.svg.xpx * correction) - (this.svg.iconPixels * adjust * correction);
      this.svg.ypx = (this.svg.ypx * correction) - (this.svg.iconPixels * 0.5 * correction) - (this.svg.iconPixels * 0.25 * correction);// - (iconPixels * 0.25 / 1.86);
    } else {
      // Get x,y in viewbox dimensions and center with half of size of icon.
      // Adjust horizontal for aligning. Can be 1, 0.5 and -1
      // Adjust vertical for half of height... and correct for 0.25em textfont to align.
      this.svg.xpx = this.svg.xpx - (this.svg.iconPixels * adjust);
      this.svg.ypx = this.svg.ypx - (this.svg.iconPixels * 0.5) - (this.svg.iconPixels * 0.25);
    }
    this.classes.icon = {};
    this.styles.icon = {};
    if (this.dev.debug) console.log('EntityIconTool constructor coords, dimensions, config', this.coords, this.dimensions, this.config);
  }

  /** *****************************************************************************
  * EntityIconTool::_buildIcon()
  *
  * Summary.
  * Builds the Icon specification name.
  *
  */
  _buildIcon(entityState, entityConfig, toolIcon) {
    return (
      this.activeAnimation?.icon // Icon from animation
      || toolIcon // Defined by tool
      || entityConfig?.icon // Defined by configuration
      || entityState?.attributes?.icon // Using entity icon
      || Se(entityState) // Use card helper logic (2021.11.21)
    );
  }

  /** *****************************************************************************
  * EntityIconTool::_renderIcon()
  *
  * Summary.
  * Renders the icon using precalculated coordinates and dimensions.
  * Only the runtime style is calculated before rendering the icon
  *
  * THIS IS THE ONE!!!!
  */

  _renderIcon() {
    this.MergeAnimationClassIfChanged();
    this.MergeAnimationStyleIfChanged();
    this.MergeColorFromState(this.styles.icon);

    const icon = this._buildIcon(
      this._card.entities[this.defaultEntityIndex()],
      this.config.hasOwnProperty('entity_index') ? this._card.config.entities[this.defaultEntityIndex()] : undefined,
      this.config.icon,
    );

    {
      this.svg.iconSize = this.config.position.icon_size ? this.config.position.icon_size : 2;
      this.svg.iconPixels = this.svg.iconSize * FONT_SIZE;

      // NEW NEW NEW Use % for size of icon...
      this.svg.iconSize = this.config.position.icon_size ? this.config.position.icon_size : 2;
      this.svg.iconPixels = Utils.calculateSvgDimension(this.svg.iconSize);

      const align = this.config.position.align ? this.config.position.align : 'center';
      const adjust = (align == 'center' ? 0.5 : (align == 'start' ? -1 : +1));

      const clientWidth = 400;
      const correction = clientWidth / (this._card.viewBox.width);

      this.svg.xpx = this.svg.cx;// (x * this._card.viewBox.width);
      this.svg.ypx = this.svg.cy;// (y * this._card.viewBox.height);

      if (((this._card.isSafari) || (this._card.iOS)) && (!this._card.isSafari16)) {
        // correction = 1; //
        this.svg.iconSize = this.svg.iconSize * correction;
        this.svg.iconPixels = this.svg.iconPixels * correction;

        this.svg.xpx = (this.svg.xpx * correction) - (this.svg.iconPixels * adjust * correction);
        this.svg.ypx = (this.svg.ypx * correction) - (this.svg.iconPixels * 0.9 * correction);
        // - (this.svg.iconPixels * 0.25 * correction);// - (iconPixels * 0.25 / 1.86);
        this.svg.xpx = (this.svg.cx * correction) - (this.svg.iconPixels * adjust * correction);
        this.svg.ypx = (this.svg.cy * correction) - (this.svg.iconPixels * adjust * correction);
      } else {
        // Get x,y in viewbox dimensions and center with half of size of icon.
        // Adjust horizontal for aligning. Can be 1, 0.5 and -1

        this.svg.xpx = this.svg.cx - (this.svg.iconPixels * adjust);
        this.svg.ypx = this.svg.cy - (this.svg.iconPixels * adjust);

        if (this.dev.debug) console.log('EntityIconTool::_renderIcon - svg values =', this.toolId, this.svg, this.config.cx, this.config.cy, align, adjust);
      }
    }

    if (!this.alternateColor) { this.alternateColor = 'rgba(0,0,0,0)'; }

    if (!SwissArmyKnifeCard.sakIconCache[icon]) {
      const theQuery = this._card.shadowRoot.getElementById('icon-'.concat(this.toolId))?.shadowRoot?.querySelectorAll('*');
      if (theQuery) {
        this.iconSvg = theQuery[0]?.path;
      } else {
        this.iconSvg = undefined;
      }

      if (!this.iconSvg) ; else {
        SwissArmyKnifeCard.sakIconCache[icon] = this.iconSvg;
      }
    } else {
      this.iconSvg = SwissArmyKnifeCard.sakIconCache[icon];
    }

    let scale;

    // NTS@20201.12.24
    // Add (true) to force rendering the Safari like solution for icons.
    // After the above fix, it seems to work for both Chrome and Safari browsers.
    // That is nice. Now animations also work on Chrome...

    if (this.iconSvg) {
      // Use original size, not the corrected one!
      this.svg.iconSize = this.config.position.icon_size ? this.config.position.icon_size : 2;
      this.svg.iconPixels = Utils.calculateSvgDimension(this.svg.iconSize);

      this.svg.x1 = this.svg.cx - this.svg.iconPixels / 2;
      this.svg.y1 = this.svg.cy - this.svg.iconPixels / 2;
      this.svg.x1 = this.svg.cx - (this.svg.iconPixels * 0.5);
      this.svg.y1 = this.svg.cy - (this.svg.iconPixels * 0.5);

      scale = this.svg.iconPixels / 24;
      // scale = 1;
      // Icon is default drawn at 0,0. As there is no separate viewbox, a transform is required
      // to position the icon on its desired location.
      // Icon is also drawn in a default 24x24 viewbox. So scale the icon to the required size using scale()
      return svg`
        <g id="icon-${this.toolId}" class="${classMap(this.classes.icon)}" style="${styleMap(this.styles.icon)}" x="${this.svg.x1}px" y="${this.svg.y1}px" transform-origin="${this.svg.cx} ${this.svg.cy}">
          <rect x="${this.svg.x1}" y="${this.svg.y1}" height="${this.svg.iconPixels}px" width="${this.svg.iconPixels}px" stroke-width="0px" fill="rgba(0,0,0,0)"></rect>
          <path d="${this.iconSvg}" transform="translate(${this.svg.x1},${this.svg.y1}) scale(${scale})"></path>
        <g>
      `;
    } else {
      // Note @2022.06.26
      // overflow="hidden" is ignored by latest and greatest Safari 15.5. Wow. Nice! Good work!
      // So use a fill/color of rgba(0,0,0,0)...
      return svg`
        <foreignObject width="0px" height="0px" x="${this.svg.xpx}" y="${this.svg.ypx}" overflow="hidden">
          <body>
            <div class="div__icon, hover" xmlns="http://www.w3.org/1999/xhtml"
                style="line-height:${this.svg.iconPixels}px;position:relative;border-style:solid;border-width:0px;border-color:${this.alternateColor};fill:${this.alternateColor};color:${this.alternateColor};">
                <ha-icon icon=${icon} id="icon-${this.toolId}"
                @animationstart=${(e) => this._handleAnimationEvent(e, this)}
                @animationiteration=${(e) => this._handleAnimationEvent(e, this)}
                style="animation: flash 0.15s 20;"></ha-icon>
            </div>
          </body>
        </foreignObject>
        `;
    }
  }

  _handleAnimationEvent(argEvent, argThis) {
    argEvent.stopPropagation();
    argEvent.preventDefault();

    argThis.iconSvg = this._card.shadowRoot.getElementById('icon-'.concat(this.toolId))?.shadowRoot?.querySelectorAll('*')[0]?.path;
    if (argThis.iconSvg) {
      argThis._card.requestUpdate();
    }
  }

  firstUpdated(changedProperties) {

  }

  /** *****************************************************************************
  * EntityIconTool::render()
  *
  * Summary.
  * The render() function for this object.
  *
  * NTS:
  * Adding        <style> div { overflow: hidden;}</style>
  * to the <g group, clips the icon against the ha-card, ie the div.
  * however, on Safari, all icons are clipped, as if they don't fit the room given to be displayed.
  * a bug in rendering the Icon?? Only first time icon is clipped, then displayed normally if a data update
  * from hass is coming in.
  */

  render() {
    return svg`
      <g "" id="icongrp-${this.toolId}" class="${classMap(this.classes.tool)}" style="${styleMap(this.styles.tool)}"
        @click=${(e) => this.handleTapEvent(e, this.config)} >

        ${this._renderIcon()}
      </g>
    `;
  }
} // END of class

/**
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** ****************************************************************************
  * BadgeTool class
  *
  * Summary.
  *
  */

class BadgeTool extends BaseTool {
  constructor(argToolset, argConfig, argPos) {
    const DEFAULT_BADGE_CONFIG = {
      position: {
        cx: 50,
        cy: 50,
        width: 100,
        height: 25,
        radius: 5,
        ratio: 30,
        divider: 30,
      },
      classes: {
        tool: {
          'sak-badge': true,
          hover: true,
        },
        left: {
          'sak-badge__left': true,
        },
        right: {
          'sak-badge__right': true,
        },
      },
      styles: {
        left: {
        },
        right: {
        },
      },
    };
    super(argToolset, Merge.mergeDeep(DEFAULT_BADGE_CONFIG, argConfig), argPos);

    // Coordinates from left and right part.
    this.svg.radius = Utils.calculateSvgDimension(argConfig.position.radius);
    this.svg.leftXpos = this.svg.x;
    this.svg.leftYpos = this.svg.y;
    this.svg.leftWidth = (this.config.position.ratio / 100) * this.svg.width;
    this.svg.arrowSize = (this.svg.height * this.config.position.divider / 100) / 2;
    this.svg.divSize = (this.svg.height * (100 - this.config.position.divider) / 100) / 2;

    this.svg.rightXpos = this.svg.x + this.svg.leftWidth;
    this.svg.rightYpos = this.svg.y;
    this.svg.rightWidth = ((100 - this.config.position.ratio) / 100) * this.svg.width;

    this.classes.left = {};
    this.classes.right = {};
    this.styles.left = {};
    this.styles.right = {};
    if (this.dev.debug) console.log('BadgeTool constructor coords, dimensions', this.svg, this.config);
  }

  /** *****************************************************************************
  * BadgeTool::_renderBadge()
  *
  * Summary.
  * Renders the badge using precalculated coordinates and dimensions.
  * Only the runtime style is calculated before rendering the badge
  *
  * Refs for creating the path online:
  * - https://mavo.io/demos/svgpath/
  *
  */

  _renderBadge() {
    let svgItems = [];

    this.MergeAnimationClassIfChanged();
    this.MergeAnimationStyleIfChanged();

    svgItems = svg`
      <g  id="badge-${this.toolId}">
        <path class="${classMap(this.classes.right)}" d="
            M ${this.svg.rightXpos} ${this.svg.rightYpos}
            h ${this.svg.rightWidth - this.svg.radius}
            a ${this.svg.radius} ${this.svg.radius} 0 0 1 ${this.svg.radius} ${this.svg.radius}
            v ${this.svg.height - 2 * this.svg.radius}
            a ${this.svg.radius} ${this.svg.radius} 0 0 1 -${this.svg.radius} ${this.svg.radius}
            h -${this.svg.rightWidth - this.svg.radius}
            v -${this.svg.height - 2 * this.svg.radius}
            z
            "
            style="${styleMap(this.styles.right)}"/>

        <path class="${classMap(this.classes.left)}" d="
            M ${this.svg.leftXpos + this.svg.radius} ${this.svg.leftYpos}
            h ${this.svg.leftWidth - this.svg.radius}
            v ${this.svg.divSize}
            l ${this.svg.arrowSize} ${this.svg.arrowSize}
            l -${this.svg.arrowSize} ${this.svg.arrowSize}
            l 0 ${this.svg.divSize}
            h -${this.svg.leftWidth - this.svg.radius}
            a -${this.svg.radius} -${this.svg.radius} 0 0 1 -${this.svg.radius} -${this.svg.radius}
            v -${this.svg.height - 2 * this.svg.radius}
            a ${this.svg.radius} ${this.svg.radius} 0 0 1 ${this.svg.radius} -${this.svg.radius}
            "
            style="${styleMap(this.styles.left)}"/>
      </g>
      `;

    return svg`${svgItems}`;
  }

  /** *****************************************************************************
  * BadgeTool::render()
  *
  * Summary.
  * The render() function for this object.
  *
  */
  render() {
    return svg`
      <g id="badge-${this.toolId}" class="${classMap(this.classes.tool)}"
        @click=${(e) => this.handleTapEvent(e, this.config)}>
        ${this._renderBadge()}
      </g>
    `;
  }
} // END of class

/**
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** ****************************************************************************
  * EntityStateTool class
  *
  * Summary.
  *
  */

class EntityStateTool extends BaseTool {
  constructor(argToolset, argConfig, argPos) {
    const DEFAULT_STATE_CONFIG = {
      show: { uom: 'end' },
      classes: {
        tool: {
          'sak-state': true,
          hover: true,
        },
        state: {
          'sak-state__value': true,
        },
        uom: {
          'sak-state__uom': true,
        },
      },
      styles: {
        state: {
        },
        uom: {
        },
      },
    };
    super(argToolset, Merge.mergeDeep(DEFAULT_STATE_CONFIG, argConfig), argPos);

    this.classes.state = {};
    this.classes.uom = {};

    this.styles.state = {};
    this.styles.uom = {};
    if (this.dev.debug) console.log('EntityStateTool constructor coords, dimensions', this.coords, this.dimensions, this.svg, this.config);
  }

  // EntityStateTool::value
  set value(state) {
    const changed = super.value = state;

    return changed;
  }

  _renderState() {
    this.MergeAnimationClassIfChanged();
    this.MergeAnimationStyleIfChanged();
    this.MergeColorFromState(this.styles.state);

    // var inState = this._stateValue?.toLowerCase();
    let inState = this._stateValue;

    if ((inState) && isNaN(inState)) {
      // const stateObj = this._card.config.entities[this.defaultEntityIndex()].entity;
      const stateObj = this._card.entities[this.defaultEntityIndex()];
      const domain = this._card._computeDomain(this._card.config.entities[this.defaultEntityIndex()].entity);

      const localeTag = this.config.locale_tag ? this.config.locale_tag + inState.toLowerCase() : undefined;
      const localeTag1 = stateObj.attributes?.device_class ? `component.${domain}.state.${stateObj.attributes.device_class}.${inState}` : '--';
      const localeTag2 = `component.${domain}.state._.${inState}`;

      inState = (localeTag && this._card.toLocale(localeTag, inState))
          || (stateObj.attributes?.device_class
          && this._card.toLocale(localeTag1, inState))
          || this._card.toLocale(localeTag2, inState)
          || stateObj.state;

      inState = this.textEllipsis(inState, this.config?.show?.ellipsis);
    }

    return svg`
      <tspan class="${classMap(this.classes.state)}" x="${this.svg.x}" y="${this.svg.y}"
        style="${styleMap(this.styles.state)}">
        ${this.config?.text?.before ? this.config.text.before : ''}${inState}${this.config?.text?.after ? this.config.text.after : ''}</tspan>
    `;
  }

  _renderUom() {
    if (this.config.show.uom === 'none') {
      return svg``;
    } else {
      this.MergeAnimationStyleIfChanged();
      this.MergeColorFromState(this.styles.uom);

      let fsuomStr = this.styles.state['font-size'];

      let fsuomValue = 0.5;
      let fsuomType = 'em';
      const fsuomSplit = fsuomStr.match(/\D+|\d*\.?\d+/g);
      if (fsuomSplit.length == 2) {
        fsuomValue = Number(fsuomSplit[0]) * 0.6;
        fsuomType = fsuomSplit[1];
      } else console.error('Cannot determine font-size for state/unit', fsuomStr);

      fsuomStr = { 'font-size': fsuomValue + fsuomType };

      this.styles.uom = Merge.mergeDeep(this.config.styles.uom, fsuomStr);

      const uom = this._card._buildUom(this.derivedEntity, this._card.entities[this.defaultEntityIndex()], this._card.config.entities[this.defaultEntityIndex()]);

      // Check for location of uom. end = next to state, bottom = below state ;-), etc.
      if (this.config.show.uom === 'end') {
        return svg`
          <tspan class="${classMap(this.classes.uom)}" dx="-0.1em" dy="-0.35em"
            style="${styleMap(this.styles.uom)}">
            ${uom}</tspan>
        `;
      } else if (this.config.show.uom === 'bottom') {
        return svg`
          <tspan class="${classMap(this.classes.uom)}" x="${this.svg.x}" dy="1.5em"
            style="${styleMap(this.styles.uom)}">
            ${uom}</tspan>
        `;
      } else if (this.config.show.uom === 'top') {
        return svg`
          <tspan class="${classMap(this.classes.uom)}" x="${this.svg.x}" dy="-1.5em"
            style="${styleMap(this.styles.uom)}">
            ${uom}</tspan>
        `;
      } else {
        return svg``;
      }
    }
  }

  firstUpdated(changedProperties) {
  }

  updated(changedProperties) {
  }

  render() {
    {
      return svg`
    <svg overflow="visible" id="state-${this.toolId}" class="${classMap(this.classes.tool)}">
        <text @click=${(e) => this.handleTapEvent(e, this.config)}>
          ${this._renderState()}
          ${this._renderUom()}
        </text>
      </svg>
      `;
    }
  } // render()
}

/**
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** ****************************************************************************
  * EntityNameTool class
  *
  * Summary.
  *
  */

class EntityNameTool extends BaseTool {
  constructor(argToolset, argConfig, argPos) {
    const DEFAULT_NAME_CONFIG = {
      classes: {
        tool: {
          'sak-name': true,
          hover: true,
        },
        name: {
          'sak-name__name': true,
        },
      },
      styles: {
        tool: {
        },
        name: {
        },
      },
    };

    super(argToolset, Merge.mergeDeep(DEFAULT_NAME_CONFIG, argConfig), argPos);

    this._name = {};
    // Init classes
    this.classes.tool = {};
    this.classes.name = {};

    // Init styles
    this.styles.name = {};
    if (this.dev.debug) console.log('EntityName constructor coords, dimensions', this.coords, this.dimensions, this.svg, this.config);
  }

  /** *****************************************************************************
  * EntityNameTool::_buildName()
  *
  * Summary.
  * Builds the Name string.
  *
  */

  _buildName(entityState, entityConfig) {
    return (
      this.activeAnimation?.name // Name from animation
      || entityConfig.name
      || entityState.attributes.friendly_name
    );
  }

  /** *****************************************************************************
  * EntityNameTool::_renderEntityName()
  *
  * Summary.
  * Renders the entity name using precalculated coordinates and dimensions.
  * Only the runtime style is calculated before rendering the name
  *
  */

  _renderEntityName() {
    this.MergeAnimationClassIfChanged();
    this.MergeColorFromState(this.styles.name);
    this.MergeAnimationStyleIfChanged();

    const name = this.textEllipsis(
      this._buildName(
        this._card.entities[this.defaultEntityIndex()],
        this._card.config.entities[this.defaultEntityIndex()],
      ),
      this.config?.show?.ellipsis,
    );

    return svg`
        <text>
          <tspan class="${classMap(this.classes.name)}" x="${this.svg.cx}" y="${this.svg.cy}" style="${styleMap(this.styles.name)}">${name}</tspan>
        </text>
      `;
  }

  /** *****************************************************************************
  * EntityNameTool::render()
  *
  * Summary.
  * The render() function for this object.
  *
  */
  render() {
    return svg`
      <g id="name-${this.toolId}" class="${classMap(this.classes.tool)}"
        @click=${(e) => this.handleTapEvent(e, this.config)}>
        ${this._renderEntityName()}
      </g>
    `;
  }
} // END of class

/**
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** ****************************************************************************
  * EntityAreaTool class
  *
  * Summary.
  *
  */

class EntityAreaTool extends BaseTool {
  constructor(argToolset, argConfig, argPos) {
    const DEFAULT_AREA_CONFIG = {
      classes: {
        tool: {
        },
        area: {
          'sak-area__area': true,
          hover: true,
        },
      },
      styles: {
        tool: {
        },
        area: {
        },
      },
    };

    super(argToolset, Merge.mergeDeep(DEFAULT_AREA_CONFIG, argConfig), argPos);

    // Text is rendered in its own context. No need for SVG coordinates.
    this.classes.area = {};
    this.styles.area = {};
    if (this.dev.debug) console.log('EntityAreaTool constructor coords, dimensions', this.coords, this.dimensions, this.svg, this.config);
  }

  /** *****************************************************************************
  * EntityAreaTool::_buildArea()
  *
  * Summary.
  * Builds the Area string.
  *
  */

  _buildArea(entityState, entityConfig) {
    return (
      entityConfig.area
      || '?'
    );
  }

  /** *****************************************************************************
  * EntityAreaTool::_renderEntityArea()
  *
  * Summary.
  * Renders the entity area using precalculated coordinates and dimensions.
  * Only the runtime style is calculated before rendering the area
  *
  */

  _renderEntityArea() {
    this.MergeAnimationClassIfChanged();
    this.MergeColorFromState(this.styles.area);
    this.MergeAnimationStyleIfChanged();

    const area = this.textEllipsis(
      this._buildArea(
        this._card.entities[this.defaultEntityIndex()],
        this._card.config.entities[this.defaultEntityIndex()],
      ),
      this.config?.show?.ellipsis,
    );

    return svg`
        <text>
          <tspan class="${classMap(this.classes.area)}"
          x="${this.svg.cx}" y="${this.svg.cy}" style="${styleMap(this.styles.area)}">${area}</tspan>
        </text>
      `;
  }

  /** *****************************************************************************
  * EntityAreaTool::render()
  *
  * Summary.
  * The render() function for this object.
  *
  */
  render() {
    return svg`
      <g id="area-${this.toolId}" class="${classMap(this.classes.tool)}"
        @click=${(e) => this.handleTapEvent(e, this.config)}>
        ${this._renderEntityArea()}
      </g>
    `;
  }
} // END of class

/**
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** ****************************************************************************
  * TextTool class
  *
  * Summary.
  *
  */

class TextTool extends BaseTool {
  constructor(argToolset, argConfig, argPos) {
    const DEFAULT_TEXT_CONFIG = {
      classes: {
        tool: {
          'sak-text': true,
        },
        text: {
          'sak-text__text': true,
          hover: false,
        },
      },
      styles: {
        tool: {
        },
        text: {
        },
      },
    };

    super(argToolset, Merge.mergeDeep(DEFAULT_TEXT_CONFIG, argConfig), argPos);

    this.EnableHoverForInteraction();
    this.text = this.config.text;
    this.styles.text = {};
    if (this.dev.debug) console.log('TextTool constructor coords, dimensions', this.coords, this.dimensions, this.svg, this.config);
  }

  /** *****************************************************************************
  * TextTool::_renderText()
  *
  * Summary.
  * Renders the text using precalculated coordinates and dimensions.
  * Only the runtime style is calculated before rendering the text
  *
  */

  _renderText() {
    this.MergeAnimationClassIfChanged();
    this.MergeColorFromState(this.styles.text);
    this.MergeAnimationStyleIfChanged();

    return svg`
        <text>
          <tspan class="${classMap(this.classes.text)}" x="${this.svg.cx}" y="${this.svg.cy}" style="${styleMap(this.styles.text)}">${this.text}</tspan>
        </text>
      `;
  }

  /** *****************************************************************************
  * TextTool::render()
  *
  * Summary.
  * The render() function for this object.
  *
  */
  render() {
    return svg`
        <g id="text-${this.toolId}" class="${classMap(this.classes.tool)}"
          @click=${(e) => this.handleTapEvent(e, this.config)}>
          ${this._renderText()}
        </g>
      `;
  }
} // END of class

/**
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** ****************************************************************************
  * HorseshoeTool class
  *
  * Summary.
  *
  */

class HorseshoeTool extends BaseTool {
  // Donut starts at -220 degrees and is 260 degrees in size.
  // zero degrees is at 3 o'clock.

  constructor(argToolset, argConfig, argPos) {
    const DEFAULT_HORSESHOE_CONFIG = {
      position: {
        cx: 50,
        cy: 50,
        radius: 45,
      },
      card_filter: 'card--filter-none',
      horseshoe_scale: {
        min: 0,
        max: 100,
        width: 3,
        color: 'var(--primary-background-color)',
      },
      horseshoe_state: {
        width: 6,
        color: 'var(--primary-color)',
      },
      show: {
        horseshoe: true,
        scale_tickmarks: false,
        horseshoe_style: 'fixed',
      },
    };

    super(argToolset, Merge.mergeDeep(DEFAULT_HORSESHOE_CONFIG, argConfig), argPos);

    // Next consts are now variable. Should be calculated!!!!!!
    this.HORSESHOE_RADIUS_SIZE = 0.45 * SVG_VIEW_BOX;
    this.TICKMARKS_RADIUS_SIZE = 0.43 * SVG_VIEW_BOX;
    this.HORSESHOE_PATH_LENGTH = 2 * 260 / 360 * Math.PI * this.HORSESHOE_RADIUS_SIZE;

    // this.config = {...DEFAULT_HORSESHOE_CONFIG};
    // this.config = {...this.config, ...argConfig};

    // if (argConfig.styles) this.config.styles = {...argConfig.styles};
    // this.config.styles = {...DEFAULT_HORSESHOE_CONFIG.styles, ...this.config.styles};

    // //if (argConfig.show) this.config.show = Object.assign(...argConfig.show);
    // this.config.show = {...DEFAULT_HORSESHOE_CONFIG.show, ...this.config.show};

    // //if (argConfig.horseshoe_scale) this.config.horseshoe_scale = Object.assign(...argConfig.horseshoe_scale);
    // this.config.horseshoe_scale = {...DEFAULT_HORSESHOE_CONFIG.horseshoe_scale, ...this.config.horseshoe_scale};

    // // if (argConfig.horseshoe_state) this.config.horseshoe_state = Object.assign(...argConfig.horseshoe_state);
    // this.config.horseshoe_state = {...DEFAULT_HORSESHOE_CONFIG.horseshoe_state, ...this.config.horseshoe_state};

    this.config.entity_index = this.config.entity_index ? this.config.entity_index : 0;

    this.svg.radius = Utils.calculateSvgDimension(this.config.position.radius);
    this.svg.radius_ticks = Utils.calculateSvgDimension(0.95 * this.config.position.radius);

    this.svg.horseshoe_scale = {};
    this.svg.horseshoe_scale.width = Utils.calculateSvgDimension(this.config.horseshoe_scale.width);
    this.svg.horseshoe_state = {};
    this.svg.horseshoe_state.width = Utils.calculateSvgDimension(this.config.horseshoe_state.width);
    this.svg.horseshoe_scale.dasharray = 2 * 26 / 36 * Math.PI * this.svg.radius;

    // The horseshoe is rotated around its svg base point. This is NOT the center of the circle!
    // Adjust x and y positions within the svg viewport to re-center the circle after rotating
    this.svg.rotate = {};
    this.svg.rotate.degrees = -220;
    this.svg.rotate.cx = this.svg.cx;
    this.svg.rotate.cy = this.svg.cy;

    // Get colorstops and make a key/value store...
    this.colorStops = {};
    if (this.config.color_stops) {
      Object.keys(this.config.color_stops).forEach((key) => {
        this.colorStops[key] = this.config.color_stops[key];
      });
    }

    this.sortedStops = Object.keys(this.colorStops).map((n) => Number(n)).sort((a, b) => a - b);

    // Create a colorStopsMinMax list for autominmax color determination
    this.colorStopsMinMax = {};
    this.colorStopsMinMax[this.config.horseshoe_scale.min] = this.colorStops[this.sortedStops[0]];
    this.colorStopsMinMax[this.config.horseshoe_scale.max] = this.colorStops[this.sortedStops[(this.sortedStops.length) - 1]];

    // Now set the color0 and color1 for the gradient used in the horseshoe to the colors
    // Use default for now!!
    this.color0 = this.colorStops[this.sortedStops[0]];
    this.color1 = this.colorStops[this.sortedStops[(this.sortedStops.length) - 1]];

    this.angleCoords = {
      x1: '0%', y1: '0%', x2: '100%', y2: '0%',
    };
    // this.angleCoords = angleCoords;
    this.color1_offset = '0%';

    //= ===================
    // End setConfig part.

    if (this.dev.debug) console.log('HorseshoeTool constructor coords, dimensions', this.coords, this.dimensions, this.svg, this.config);
  }

  /** *****************************************************************************
  * HorseshoeTool::value()
  *
  * Summary.
  * Sets the value of the horseshoe. Value updated via set hass.
  * Calculate horseshoe settings & colors depening on config and new value.
  *
  */

  set value(state) {
    if (this._stateValue == state) return false;

    this._stateValuePrev = this._stateValue || state;
    this._stateValue = state;
    this._stateValueIsDirty = true;

    // Calculate the size of the arc to fill the dasharray with this
    // value. It will fill the horseshoe relative to the state and min/max
    // values given in the configuration.

    const min = this.config.horseshoe_scale.min || 0;
    const max = this.config.horseshoe_scale.max || 100;
    const val = Math.min(this._card._calculateValueBetween(min, max, state), 1);
    const score = val * this.HORSESHOE_PATH_LENGTH;
    const total = 10 * this.HORSESHOE_RADIUS_SIZE;
    this.dashArray = `${score} ${total}`;

    // We must draw the horseshoe. Depending on the stroke settings, we draw a fixed color, gradient, autominmax or colorstop
    // #TODO: only if state or attribute has changed.

    const strokeStyle = this.config.show.horseshoe_style;

    if (strokeStyle == 'fixed') {
      this.stroke_color = this.config.horseshoe_state.color;
      this.color0 = this.config.horseshoe_state.color;
      this.color1 = this.config.horseshoe_state.color;
      this.color1_offset = '0%';
      //  We could set the circle attributes, but we do it with a variable as we are using a gradient
      //  to display the horseshoe circle .. <horseshoe circle>.setAttribute('stroke', stroke);
    } else if (strokeStyle == 'autominmax') {
      // Use color0 and color1 for autoranging the color of the horseshoe
      const stroke = this._card._calculateColor(state, this.colorStopsMinMax, true);

      // We now use a gradient for the horseshoe, using two colors
      // Set these colors to the colorstop color...
      this.color0 = stroke;
      this.color1 = stroke;
      this.color1_offset = '0%';
    } else if (strokeStyle == 'colorstop' || strokeStyle == 'colorstopgradient') {
      const stroke = this._card._calculateColor(state, this.colorStops, strokeStyle === 'colorstopgradient');

      // We now use a gradient for the horseshoe, using two colors
      // Set these colors to the colorstop color...
      this.color0 = stroke;
      this.color1 = stroke;
      this.color1_offset = '0%';
    } else if (strokeStyle == 'lineargradient') {
      // This has taken a lot of time to get a satisfying result, and it appeared much simpler than anticipated.
      // I don't understand it, but for a circle, a gradient from left/right with adjusted stop is enough ?!?!?!
      // No calculations to adjust the angle of the gradient, or rotating the gradient itself.
      // Weird, but it works. Not a 100% match, but it is good enough for now...

      // According to stackoverflow, these calculations / adjustments would be needed, but it isn't ;-)
      // Added from https://stackoverflow.com/questions/9025678/how-to-get-a-rotated-linear-gradient-svg-for-use-as-a-background-image
      const angleCoords = {
        x1: '0%', y1: '0%', x2: '100%', y2: '0%',
      };
      this.color1_offset = `${Math.round((1 - val) * 100)}%`;

      this.angleCoords = angleCoords;
    }
    if (this.dev.debug) console.log('HorseshoeTool set value', this.cardId, state);

    return true;
  }

  /** *****************************************************************************
  * HorseshoeTool::_renderTickMarks()
  *
  * Summary.
  * Renders the tick marks on the scale.
  *
  */

  _renderTickMarks() {
    const { config } = this;
    // if (!config) return;
    // if (!config.show) return;
    if (!config.show.scale_tickmarks) return;

    const stroke = config.horseshoe_scale.color ? config.horseshoe_scale.color : 'var(--primary-background-color)';
    const tickSize = config.horseshoe_scale.ticksize ? config.horseshoe_scale.ticksize
      : (config.horseshoe_scale.max - config.horseshoe_scale.min) / 10;

    // fullScale is 260 degrees. Hard coded for now...
    const fullScale = 260;
    const remainder = config.horseshoe_scale.min % tickSize;
    const startTickValue = config.horseshoe_scale.min + (remainder == 0 ? 0 : (tickSize - remainder));
    const startAngle = ((startTickValue - config.horseshoe_scale.min)
                        / (config.horseshoe_scale.max - config.horseshoe_scale.min)) * fullScale;
    const tickSteps = ((config.horseshoe_scale.max - startTickValue) / tickSize);

    // new
    let steps = Math.floor(tickSteps);
    const angleStepSize = (fullScale - startAngle) / tickSteps;

    // If steps exactly match the max. value/range, add extra step for that max value.
    if ((Math.floor(((steps) * tickSize) + startTickValue)) <= (config.horseshoe_scale.max)) { steps++; }

    const radius = this.svg.horseshoe_scale.width ? this.svg.horseshoe_scale.width / 2 : 6 / 2;
    let angle;
    const scaleItems = [];

    // NTS:
    // Value of -230 is weird. Should be -220. Can't find why...
    let i;
    for (i = 0; i < steps; i++) {
      angle = startAngle + ((-230 + (360 - i * angleStepSize)) * Math.PI / 180);
      scaleItems[i] = svg`
        <circle cx="${this.svg.cx - Math.sin(angle) * this.svg.radius_ticks}"
                cy="${this.svg.cy - Math.cos(angle) * this.svg.radius_ticks}" r="${radius}"
                fill="${stroke}">
      `;
    }
    return svg`${scaleItems}`;
  }

  /** *****************************************************************************
  * HorseshoeTool::_renderHorseShoe()
  *
  * Summary.
  * Renders the horseshoe group.
  *
  * Description.
  * The horseshoes are rendered in a viewbox of 200x200 (SVG_VIEW_BOX).
  * Both are centered with a radius of 45%, ie 200*0.45 = 90.
  *
  * The foreground horseshoe is always rendered as a gradient with two colors.
  *
  * The horseshoes are rotated 220 degrees and are 2 * 26/36 * Math.PI * r in size
  * There you get your value of 408.4070449,180 ;-)
  */

  _renderHorseShoe() {
    if (!this.config.show.horseshoe) return;

    return svg`
      <g id="horseshoe__group-inner" class="horseshoe__group-inner">
        <circle id="horseshoe__scale" class="horseshoe__scale" cx="${this.svg.cx}" cy="${this.svg.cy}" r="${this.svg.radius}"
          fill="${this.fill || 'rgba(0, 0, 0, 0)'}"
          stroke="${this.config.horseshoe_scale.color || '#000000'}"
          stroke-dasharray="${this.svg.horseshoe_scale.dasharray}"
          stroke-width="${this.svg.horseshoe_scale.width}"
          stroke-linecap="square"
          transform="rotate(-220 ${this.svg.rotate.cx} ${this.svg.rotate.cy})"/>

        <circle id="horseshoe__state__value" class="horseshoe__state__value" cx="${this.svg.cx}" cy="${this.svg.cy}" r="${this.svg.radius}"
          fill="${this.config.fill || 'rgba(0, 0, 0, 0)'}"
          stroke="url('#horseshoe__gradient-${this.cardId}')"
          stroke-dasharray="${this.dashArray}"
          stroke-width="${this.svg.horseshoe_state.width}"
          stroke-linecap="square"
          transform="rotate(-220 ${this.svg.rotate.cx} ${this.svg.rotate.cy})"/>

        ${this._renderTickMarks()}
      </g>
    `;
  }

  /** *****************************************************************************
  * HorseshoeTool::render()
  *
  * Summary.
  * The render() function for this object.
  *
  */
  render() {
    return svg`
      <g "" id="horseshoe-${this.toolId}" class="horseshoe__group-outer"
        @click=${(e) => this.handleTapEvent(e, this.config)}>
        ${this._renderHorseShoe()}
      </g>

      <svg style="width:0;height:0;position:absolute;" aria-hidden="true" focusable="false">
        <linearGradient gradientTransform="rotate(0)" id="horseshoe__gradient-${this.cardId}" x1="${this.angleCoords.x1}", y1="${this.angleCoords.y1}", x2="${this.angleCoords.x2}" y2="${this.angleCoords.y2}">
          <stop offset="${this.color1_offset}" stop-color="${this.color1}" />
          <stop offset="100%" stop-color="${this.color0}" />
        </linearGradient>
      </svg>

    `;
  }
} // END of class

/**
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

class SparklineBarChartTool extends BaseTool {
  constructor(argToolset, argConfig, argPos) {
    const DEFAULT_BARCHART_CONFIG = {
      position: {
        cx: 50,
        cy: 50,
        height: 25,
        width: 25,
        margin: 0.5,
        orientation: 'vertical',
      },
      hours: 24,
      barhours: 1,
      color: 'var(--primary-color)',
      classes: {
        tool: {
          'sak-barchart': true,
          hover: true,
        },
        bar: {
        },
        line: {
          'sak-barchart__line': true,
          hover: true,
        },
      },
      styles: {
        tool: {
        },
        line: {
        },
        bar: {
        },
      },
      colorstops: [],
      show: { style: 'fixedcolor' },
    };

    super(argToolset, Merge.mergeDeep(DEFAULT_BARCHART_CONFIG, argConfig), argPos);

    this.svg.margin = Utils.calculateSvgDimension(this.config.position.margin);
    const theWidth = (this.config.position.orientation == 'vertical') ? this.svg.width : this.svg.height;

    this.svg.barWidth = (theWidth - (((this.config.hours / this.config.barhours) - 1)
                                * this.svg.margin)) / (this.config.hours / this.config.barhours);
    this._data = [];
    this._bars = [];
    this._scale = {};
    this._needsRendering = false;

    this.classes.bar = {};

    this.styles.tool = {};
    this.styles.line = {};
    this.stylesBar = {};

    if (this.dev.debug) console.log('SparkleBarChart constructor coords, dimensions', this.coords, this.dimensions, this.svg, this.config);
  }

  /** *****************************************************************************
  * SparklineBarChartTool::computeMinMax()
  *
  * Summary.
  * Compute min/max values of bars to scale them to the maximum amount.
  *
  */
  computeMinMax() {
    let min = this._series[0]; let
      max = this._series[0];

    for (let i = 1, len = this._series.length; i < len; i++) {
      const v = this._series[i];
      min = (v < min) ? v : min;
      max = (v > max) ? v : max;
    }
    this._scale.min = min;
    this._scale.max = max;
    this._scale.size = (max - min);

    // 2020.11.05
    // Add 5% to the size of the scale and adjust the minimum value displayed.
    // So every bar is displayed, instead of the min value having a bar length of zero!
    this._scale.size = (max - min) * 1.05;
    this._scale.min = max - this._scale.size;
  }

  /** *****************************************************************************
  * SparklineBarChartTool::set series
  *
  * Summary.
  * Sets the timeseries for the barchart tool. Is an array of states.
  * If this is historical data, the caller has taken the time to create this.
  * This tool only displays the result...
  *
  */
  set data(states) {
    this._series = Object.assign(states);
    this.computeBars();
    this._needsRendering = true;
  }

  set series(states) {
    this._series = Object.assign(states);
    this.computeBars();
    this._needsRendering = true;
  }

  hasSeries() {
    return this.defaultEntityIndex();
  }

  /** *****************************************************************************
  * SparklineBarChartTool::computeBars()
  *
  * Summary.
  * Compute start and end of bars for easy rendering.
  *
  */
  computeBars({ _bars } = this) {
    this.computeMinMax();

    if (this.config.show.style === 'minmaxgradient') {
      this.colorStopsMinMax = {};
      this.colorStopsMinMax = {
        [this._scale.min.toString()]: this.config.minmaxgradient.colors.min,
        [this._scale.max.toString()]: this.config.minmaxgradient.colors.max,
      };
    }

    // VERTICAL
    if (this.config.position.orientation == 'vertical') {
      if (this.dev.debug) console.log('bar is vertical');
      this._series.forEach((item, index) => {
        if (!_bars[index]) _bars[index] = {};
        _bars[index].length = (this._scale.size == 0) ? 0 : ((item - this._scale.min) / (this._scale.size)) * this.svg.height;
        _bars[index].x1 = this.svg.x + this.svg.barWidth / 2 + ((this.svg.barWidth + this.svg.margin) * index);
        _bars[index].x2 = _bars[index].x1;
        _bars[index].y1 = this.svg.y + this.svg.height;
        _bars[index].y2 = _bars[index].y1 - this._bars[index].length;
        _bars[index].dataLength = this._bars[index].length;
      });
      // HORIZONTAL
    } else if (this.config.position.orientation == 'horizontal') {
      if (this.dev.debug) console.log('bar is horizontal');
      this._data.forEach((item, index) => {
        if (!_bars[index]) _bars[index] = {};
        // if (!item || isNaN(item)) item = this._scale.min;
        _bars[index].length = (this._scale.size == 0) ? 0 : ((item - this._scale.min) / (this._scale.size)) * this.svg.width;
        _bars[index].y1 = this.svg.y + this.svg.barWidth / 2 + ((this.svg.barWidth + this.svg.margin) * index);
        _bars[index].y2 = _bars[index].y1;
        _bars[index].x1 = this.svg.x;
        _bars[index].x2 = _bars[index].x1 + this._bars[index].length;
        _bars[index].dataLength = this._bars[index].length;
      });
    } else if (this.dev.debug) console.log('SparklineBarChartTool - unknown barchart orientation (horizontal or vertical)');
  }

  /** *****************************************************************************
  * SparklineBarChartTool::_renderBars()
  *
  * Summary.
  * Render all the bars. Number of bars depend on hours and barhours settings.
  *
  */
  _renderBars({ _bars } = this) {
    const svgItems = [];

    if (this._bars.length == 0) return;

    if (this.dev.debug) console.log('_renderBars IN', this.toolId);

    this._bars.forEach((item, index) => {
      if (this.dev.debug) console.log('_renderBars - bars', item, index);

      const stroke = this.getColorFromState(this._series[index]);

      if (!this.stylesBar[index])
        this.stylesBar[index] = { ...this.config.styles.bar };

      // NOTE @ 2021.10.27
      // Lijkt dat this.classes niet gevuld wordt. geen merge enzo. is dat een bug?
      // Nu tijdelijk opgelost door this.config te gebruiken, maar hoort niet natuurlijk als je kijkt
      // naar de andere tools...

      // Safeguard...
      if (!(this._bars[index].y2)) console.log('sparklebarchart y2 invalid', this._bars[index]);
      svgItems.push(svg`
        <line id="line-segment-${this.toolId}-${index}" class="${classMap(this.config.classes.line)}"
                  style="${styleMap(this.stylesBar[index])}"
                  x1="${this._bars[index].x1}"
                  x2="${this._bars[index].x2}"
                  y1="${this._bars[index].y1}"
                  y2="${this._bars[index].y2}"
                  data-length="${this._bars[index].dataLength}"
                  stroke="${stroke}"
                  stroke-width="${this.svg.barWidth}"
                  />
        `);
    });
    if (this.dev.debug) console.log('_renderBars OUT', this.toolId);

    return svg`${svgItems}`;
  }

  /** *****************************************************************************
  * SparklineBarChartTool::render()
  *
  * Summary.
  * The actual render() function called by the card for each tool.
  *
  */
  render() {
    return svg`
      <g id="barchart-${this.toolId}" class="${classMap(this.classes.tool)}"
        @click=${(e) => this.handleTapEvent(e, this.config)}>
        ${this._renderBars()}
      </g>
    `;
  }
}

/**
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/** *****************************************************************************
  * SegmentedArcTool class
  *
  * Summary.
  *
  */

class SegmentedArcTool extends BaseTool {
  constructor(argToolset, argConfig, argPos) {
    const DEFAULT_SEGARC_CONFIG = {
      position: {
        cx: 50,
        cy: 50,
        radius: 45,
        width: 3,
        margin: 1.5,
      },
      color: 'var(--primary-color)',
      classes: {
        tool: {
        },
        foreground: {
        },
        background: {
        },
      },
      styles: {
        foreground: {
        },
        background: {
        },
      },
      segments: {},
      colorstops: [],
      scale: {
        min: 0,
        max: 100,
        width: 2,
        offset: -3.5,
      },
      show: {
        style: 'fixedcolor',
        scale: false,
      },
      isScale: false,
      animation: {
        duration: 1.5,
      },
    };

    super(argToolset, Merge.mergeDeep(DEFAULT_SEGARC_CONFIG, argConfig), argPos);

    if (this.dev.performance) console.time(`--> ${this.toolId} PERFORMANCE SegmentedArcTool::constructor`);

    this.svg.radius = Utils.calculateSvgDimension(argConfig.position.radius);
    this.svg.radiusX = Utils.calculateSvgDimension(argConfig.position.radius_x || argConfig.position.radius);
    this.svg.radiusY = Utils.calculateSvgDimension(argConfig.position.radius_y || argConfig.position.radius);

    this.svg.segments = {};
    // #TODO:
    // Get gap from colorlist, colorstop or something else. Not from the default segments gap.
    this.svg.segments.gap = Utils.calculateSvgDimension(this.config.segments.gap);
    this.svg.scale_offset = Utils.calculateSvgDimension(this.config.scale.offset);

    // Added for confusion???????
    this._firstUpdatedCalled = false;

    // Remember the values to be able to render from/to
    this._stateValue = null;
    this._stateValuePrev = null;
    this._stateValueIsDirty = false;
    this._renderFrom = null;
    this._renderTo = null;

    this.rAFid = null;
    this.cancelAnimation = false;

    this.arcId = null;

    // Cache path (d= value) of segments drawn in map by segment index (counter). Simple array.
    this._cache = [];

    this._segmentAngles = [];
    this._segments = {};

    // Precalculate segments with start and end angle!
    this._arc = {};
    this._arc.size = Math.abs(this.config.position.end_angle - this.config.position.start_angle);
    this._arc.clockwise = this.config.position.end_angle > this.config.position.start_angle;
    this._arc.direction = this._arc.clockwise ? 1 : -1;

    let tcolorlist = {};
    let colorlist = null;
    // New template testing for colorstops
    if (this.config.segments.colorlist?.template) {
      colorlist = this.config.segments.colorlist;
      if (this._card.lovelace.config.sak_user_templates.templates[colorlist.template.name]) {
        if (this.dev.debug) console.log('SegmentedArcTool::constructor - templates colorlist found', colorlist.template.name);
        tcolorlist = Templates.replaceVariables2(colorlist.template.variables, this._card.lovelace.config.sak_user_templates.templates[colorlist.template.name]);
        this.config.segments.colorlist = tcolorlist;
      }
    }

    // FIXEDCOLOR
    if (this.config.show.style == 'fixedcolor') ;
    // COLORLIST
    else if (this.config.show.style == 'colorlist') {
      // Get number of segments, and their size in degrees.
      this._segments.count = this.config.segments.colorlist.colors.length;
      this._segments.size = this._arc.size / this._segments.count;
      this._segments.gap = (this.config.segments.colorlist.gap != 'undefined') ? this.config.segments.colorlist.gap : 1;
      this._segments.sizeList = [];
      for (var i = 0; i < this._segments.count; i++) {
        this._segments.sizeList[i] = this._segments.size;
      }

      // Use a running total for the size of the segments...
      var segmentRunningSize = 0;
      for (var i = 0; i < this._segments.count; i++) {
        this._segmentAngles[i] = {
          boundsStart: this.config.position.start_angle + (segmentRunningSize * this._arc.direction),
          boundsEnd: this.config.position.start_angle + ((segmentRunningSize + this._segments.sizeList[i]) * this._arc.direction),
          drawStart: this.config.position.start_angle + (segmentRunningSize * this._arc.direction) + (this._segments.gap * this._arc.direction),
          drawEnd: this.config.position.start_angle + ((segmentRunningSize + this._segments.sizeList[i]) * this._arc.direction) - (this._segments.gap * this._arc.direction),
        };
        segmentRunningSize += this._segments.sizeList[i];
      }

      if (this.dev.debug) console.log('colorstuff - COLORLIST', this._segments, this._segmentAngles);
    }
    // COLORSTOPS
    else if (this.config.show.style == 'colorstops') {
      // Get colorstops, remove outliers and make a key/value store...

      this._segments.colorStops = {};
      Object.keys(this.config.segments.colorstops.colors).forEach((key) => {
        if ((key >= this.config.scale.min)
              && (key <= this.config.scale.max))
          this._segments.colorStops[key] = this.config.segments.colorstops.colors[key];
      });

      this._segments.sortedStops = Object.keys(this._segments.colorStops).map((n) => Number(n)).sort((a, b) => a - b);

      // Insert extra stopcolor for max scale if not defined. Otherwise color calculations won't work as expected...
      if (typeof (this._segments.colorStops[this.config.scale.max]) === 'undefined') {
        this._segments.colorStops[this.config.scale.max] = this._segments.colorStops[this._segments.sortedStops[this._segments.sortedStops.length - 1]];
        this._segments.sortedStops = Object.keys(this._segments.colorStops).map((n) => Number(n)).sort((a, b) => a - b);
      }

      this._segments.count = this._segments.sortedStops.length - 1;
      this._segments.gap = this.config.segments.colorstops.gap != 'undefined' ? this.config.segments.colorstops.gap : 1;

      // Now depending on the colorstops and min/max values, calculate the size of each segment relative to the total arc size.
      // First color in the list starts from Min!

      let runningColorStop = this.config.scale.min;
      const scaleRange = this.config.scale.max - this.config.scale.min;
      this._segments.sizeList = [];
      for (var i = 0; i < this._segments.count; i++) {
        const colorSize = this._segments.sortedStops[i + 1] - runningColorStop;
        runningColorStop += colorSize;
        // Calculate fraction [0..1] of colorSize of min/max scale range
        const fraction = colorSize / scaleRange;
        const angleSize = fraction * this._arc.size;
        this._segments.sizeList[i] = angleSize;
      }

      // Use a running total for the size of the segments...
      var segmentRunningSize = 0;
      for (var i = 0; i < this._segments.count; i++) {
        this._segmentAngles[i] = {
          boundsStart: this.config.position.start_angle + (segmentRunningSize * this._arc.direction),
          boundsEnd: this.config.position.start_angle + ((segmentRunningSize + this._segments.sizeList[i]) * this._arc.direction),
          drawStart: this.config.position.start_angle + (segmentRunningSize * this._arc.direction) + (this._segments.gap * this._arc.direction),
          drawEnd: this.config.position.start_angle + ((segmentRunningSize + this._segments.sizeList[i]) * this._arc.direction) - (this._segments.gap * this._arc.direction),
        };
        segmentRunningSize += this._segments.sizeList[i];
        if (this.dev.debug) console.log('colorstuff - COLORSTOPS++ segments', segmentRunningSize, this._segmentAngles[i]);
      }

      if (this.dev.debug) console.log('colorstuff - COLORSTOPS++', this._segments, this._segmentAngles, this._arc.direction, this._segments.count);
    }
    // SIMPLEGRADIENT
    else if (this.config.show.style == 'simplegradient') ;

    // Just dump to console for verification. Nothing is used yet of the new calculation method...

    if (this.config.isScale) {
      this._stateValue = this.config.scale.max;
      // this.config.show.scale = false;
    } else {
      // Nope. I'm the main arc. Check if a scale is defined and clone myself with some options...
      if (this.config.show.scale) {
        const scaleConfig = Merge.mergeDeep(this.config);
        scaleConfig.id += '-scale';

        // Cloning done. Now set specific scale options.
        scaleConfig.show.scale = false;
        scaleConfig.isScale = true;
        scaleConfig.position.width = this.config.scale.width;
        scaleConfig.position.radius = this.config.position.radius - (this.config.position.width / 2) + (scaleConfig.position.width / 2) + (this.config.scale.offset);
        scaleConfig.position.radius_x = ((this.config.position.radius_x || this.config.position.radius)) - (this.config.position.width / 2) + (scaleConfig.position.width / 2) + (this.config.scale.offset);
        scaleConfig.position.radius_y = ((this.config.position.radius_y || this.config.position.radius)) - (this.config.position.width / 2) + (scaleConfig.position.width / 2) + (this.config.scale.offset);

        this._segmentedArcScale = new SegmentedArcTool(this, scaleConfig, argPos);
      } else {
        this._segmentedArcScale = null;
      }
    }

    // testing. use below two lines and sckip the calculation of the segmentAngles. Those are done above with different calculation...
    this.skipOriginal = ((this.config.show.style == 'colorstops') || (this.config.show.style == 'colorlist'));

    // Set scale to new value. Never changes of course!!
    if (this.skipOriginal) {
      if (this.config.isScale) this._stateValuePrev = this._stateValue;
      this._initialDraw = false;
    }

    this._arc.parts = Math.floor(this._arc.size / Math.abs(this.config.segments.dash));
    this._arc.partsPartialSize = this._arc.size - (this._arc.parts * this.config.segments.dash);

    if (this.skipOriginal) {
      this._arc.parts = this._segmentAngles.length;
      this._arc.partsPartialSize = 0;
    } else {
      for (var i = 0; i < this._arc.parts; i++) {
        this._segmentAngles[i] = {
          boundsStart: this.config.position.start_angle + (i * this.config.segments.dash * this._arc.direction),
          boundsEnd: this.config.position.start_angle + ((i + 1) * this.config.segments.dash * this._arc.direction),
          drawStart: this.config.position.start_angle + (i * this.config.segments.dash * this._arc.direction) + (this.config.segments.gap * this._arc.direction),
          drawEnd: this.config.position.start_angle + ((i + 1) * this.config.segments.dash * this._arc.direction) - (this.config.segments.gap * this._arc.direction),
        };
      }
      if (this._arc.partsPartialSize > 0) {
        this._segmentAngles[i] = {
          boundsStart: this.config.position.start_angle + (i * this.config.segments.dash * this._arc.direction),
          boundsEnd: this.config.position.start_angle + ((i + 0) * this.config.segments.dash * this._arc.direction)
                                          + (this._arc.partsPartialSize * this._arc.direction),

          drawStart: this.config.position.start_angle + (i * this.config.segments.dash * this._arc.direction) + (this.config.segments.gap * this._arc.direction),
          drawEnd: this.config.position.start_angle + ((i + 0) * this.config.segments.dash * this._arc.direction)
                                          + (this._arc.partsPartialSize * this._arc.direction) - (this.config.segments.gap * this._arc.direction),
        };
      }
    }

    this.starttime = null;

    if (this.dev.debug) console.log('SegmentedArcTool constructor coords, dimensions', this.coords, this.dimensions, this.svg, this.config);
    if (this.dev.debug) console.log('SegmentedArcTool - init', this.toolId, this.config.isScale, this._segmentAngles);

    if (this.dev.performance) console.timeEnd(`--> ${this.toolId} PERFORMANCE SegmentedArcTool::constructor`);
  }

  // SegmentedArcTool::objectId
  get objectId() {
    return this.toolId;
  }

  // SegmentedArcTool::value
  set value(state) {
    if (this.dev.debug) console.log('SegmentedArcTool - set value IN');

    if (this.config.isScale) return false;

    if (this._stateValue == state) return false;

    const changed = super.value = state;

    return changed;
  }

  // SegmentedArcTool::firstUpdated
  // Me is updated. Get arc id for animations...
  firstUpdated(changedProperties) {
    if (this.dev.debug) console.log('SegmentedArcTool - firstUpdated IN with _arcId/id', this._arcId, this.toolId, this.config.isScale);
    this._arcId = this._card.shadowRoot.getElementById('arc-'.concat(this.toolId));

    this._firstUpdatedCalled = true;

    // Just a try.
    //
    // was this a bug. The scale was never called with updated. Hence always no arcId...
    this._segmentedArcScale?.firstUpdated(changedProperties);

    if (this.skipOriginal) {
      if (this.dev.debug) console.log('RENDERNEW - firstUpdated IN with _arcId/id/isScale/scale/connected', this._arcId, this.toolId, this.config.isScale, this._segmentedArcScale, this._card.connected);
      if (!this.config.isScale) this._stateValuePrev = null;
      this._initialDraw = true;
      this._card.requestUpdate();
    }
  }

  // SegmentedArcTool::updated

  updated(changedProperties) {
    if (this.dev.debug) console.log('SegmentedArcTool - updated IN');
  }

  // SegmentedArcTool::render

  render() {
    if (this.dev.debug) console.log('SegmentedArcTool RENDERNEW - Render IN');
    return svg`
      <g "" id="arc-${this.toolId}" class="arc">
        <g >
          ${this._renderSegments()}
          </g>
        ${this._renderScale()}
      </g>
    `;
  }

  _renderScale() {
    if (this._segmentedArcScale) return this._segmentedArcScale.render();
  }

  _renderSegments() {
    // migrate to new solution to draw segmented arc...

    if (this.skipOriginal) {
      // Here we can rebuild all needed. Much will be the same I guess...

      let arcEnd;
      let arcEndPrev;
      const arcWidth = this.svg.width;
      const arcRadiusX = this.svg.radiusX;
      const arcRadiusY = this.svg.radiusY;

      let d;

      if (this.dev.debug) console.log('RENDERNEW - IN _arcId, firstUpdatedCalled', this._arcId, this._firstUpdatedCalled);
      // calculate real end angle depending on value set in object and min/max scale
      const val = Utils.calculateValueBetween(this.config.scale.min, this.config.scale.max, this._stateValue);
      const valPrev = Utils.calculateValueBetween(this.config.scale.min, this.config.scale.max, this._stateValuePrev);
      if (this.dev.debug) if (!this._stateValuePrev) console.log('*****UNDEFINED', this._stateValue, this._stateValuePrev, valPrev);
      if (val != valPrev) if (this.dev.debug) console.log('RENDERNEW _renderSegments diff value old new', this.toolId, valPrev, val);

      arcEnd = (val * this._arc.size * this._arc.direction) + this.config.position.start_angle;
      arcEndPrev = (valPrev * this._arc.size * this._arc.direction) + this.config.position.start_angle;

      const svgItems = [];

      // NO background needed for drawing scale...
      if (!this.config.isScale) {
        for (let k = 0; k < this._segmentAngles.length; k++) {
          d = this.buildArcPath(
            this._segmentAngles[k].drawStart,
            this._segmentAngles[k].drawEnd,
            this._arc.clockwise,
            this.svg.radiusX,
            this.svg.radiusY,
            this.svg.width,
          );

          svgItems.push(svg`<path id="arc-segment-bg-${this.toolId}-${k}" class="sak-segarc__background"
                              style="${styleMap(this.config.styles.background)}"
                              d="${d}"
                              />`);
        }
      }

      // Check if arcId does exist
      if (this._firstUpdatedCalled) {
        //      if ((this._arcId)) {
        if (this.dev.debug) console.log('RENDERNEW _arcId DOES exist', this._arcId, this.toolId, this._firstUpdatedCalled);

        // Render current from cache
        this._cache.forEach((item, index) => {
          d = item;

          // extra, set color from colorlist as a test
          if (this.config.isScale) {
            let fill = this.config.color;
            if (this.config.show.style === 'colorlist') {
              fill = this.config.segments.colorlist.colors[index];
            }
            if (this.config.show.style === 'colorstops') {
              fill = this._segments.colorStops[this._segments.sortedStops[index]];
              // stroke = this.config.segments.colorstops.stroke ? this._segments.colorStops[this._segments.sortedStops[index]] : '';
            }

            if (!this.styles.foreground[index]) {
              this.styles.foreground[index] = Merge.mergeDeep(this.config.styles.foreground);
            }

            this.styles.foreground[index].fill = fill;
            // this.styles.foreground[index]['stroke'] = stroke;
          }

          svgItems.push(svg`<path id="arc-segment-${this.toolId}-${index}" class="sak-segarc__foreground"
                            style="${styleMap(this.styles.foreground[index])}"
                            d="${d}"
                            />`);
        });

        const tween = {};

        function animateSegmentsNEW(timestamp, thisTool) {
          const easeOut = (progress) => --progress ** 5 + 1;

          let frameSegment;
          let runningSegment;

          var timestamp = timestamp || new Date().getTime();
          if (!tween.startTime) {
            tween.startTime = timestamp;
            tween.runningAngle = tween.fromAngle;
          }

          if (thisTool.debug) console.log('RENDERNEW - in animateSegmentsNEW', thisTool.toolId, tween);

          const runtime = timestamp - tween.startTime;
          tween.progress = Math.min(runtime / tween.duration, 1);
          tween.progress = easeOut(tween.progress);

          const increase = ((thisTool._arc.clockwise)
            ? (tween.toAngle > tween.fromAngle) : (tween.fromAngle > tween.toAngle));

          // Calculate where the animation angle should be now in this animation frame: angle and segment.
          tween.frameAngle = tween.fromAngle + ((tween.toAngle - tween.fromAngle) * tween.progress);
          frameSegment = thisTool._segmentAngles.findIndex((currentValue, index) => (thisTool._arc.clockwise
            ? ((tween.frameAngle <= currentValue.boundsEnd) && (tween.frameAngle >= currentValue.boundsStart))
            : ((tween.frameAngle <= currentValue.boundsStart) && (tween.frameAngle >= currentValue.boundsEnd))));

          if (frameSegment == -1) {
            /* if (thisTool.debug) */ console.log('RENDERNEW animateSegments frameAngle not found', tween, thisTool._segmentAngles);
            console.log('config', thisTool.config);
          }

          // Check where we actually are now. This might be in a different segment...
          runningSegment = thisTool._segmentAngles.findIndex((currentValue, index) => (thisTool._arc.clockwise
            ? ((tween.runningAngle <= currentValue.boundsEnd) && (tween.runningAngle >= currentValue.boundsStart))
            : ((tween.runningAngle <= currentValue.boundsStart) && (tween.runningAngle >= currentValue.boundsEnd))));

          // Weird stuff. runningSegment is sometimes -1. Ie not FOUND !! WTF??
          // if (runningSegment == -1) runningSegment = 0;

          // Do render segments until the animation angle is at the requested animation frame angle.
          do {
            const aniStartAngle = thisTool._segmentAngles[runningSegment].drawStart;
            var runningSegmentAngle = thisTool._arc.clockwise
              ? Math.min(thisTool._segmentAngles[runningSegment].boundsEnd, tween.frameAngle)
              : Math.max(thisTool._segmentAngles[runningSegment].boundsEnd, tween.frameAngle);
            const aniEndAngle = thisTool._arc.clockwise
              ? Math.min(thisTool._segmentAngles[runningSegment].drawEnd, tween.frameAngle)
              : Math.max(thisTool._segmentAngles[runningSegment].drawEnd, tween.frameAngle);
              // First phase. Just draw and ignore segments...
            d = thisTool.buildArcPath(aniStartAngle, aniEndAngle, thisTool._arc.clockwise, arcRadiusX, arcRadiusY, arcWidth);

            if (!thisTool.myarc) thisTool.myarc = {};
            if (!thisTool.as) thisTool.as = {};

            let as;
            const myarc = 'arc-segment-'.concat(thisTool.toolId).concat('-').concat(runningSegment);
            // as = thisTool._card.shadowRoot.getElementById(myarc);
            if (!thisTool.as[runningSegment])
              thisTool.as[runningSegment] = thisTool._card.shadowRoot.getElementById(myarc);
            as = thisTool.as[runningSegment];
            // Extra. Remember id's and references
            // Quick hack...
            thisTool.myarc[runningSegment] = myarc;
            // thisTool.as[runningSegment] = as;

            if (as) {
              // var e = as.getAttribute("d");
              as.setAttribute('d', d);

              // We also have to set the style fill if the color stops and gradients are implemented
              // As we're using styles, attributes won't work. Must use as.style.fill = 'calculated color'
              // #TODO
              // Can't use gradients probably because of custom path. Conic-gradient would be fine.
              //
              // First try...
              if (thisTool.config.show.style === 'colorlist') {
                as.style.fill = thisTool.config.segments.colorlist.colors[runningSegment];
                thisTool.styles.foreground[runningSegment].fill = thisTool.config.segments.colorlist.colors[runningSegment];
              }
              // #WIP
              // Testing 'lastcolor'
              if (thisTool.config.show.lastcolor) {
                var fill;

                const boundsStart = thisTool._arc.clockwise
                  ? (thisTool._segmentAngles[runningSegment].drawStart)
                  : (thisTool._segmentAngles[runningSegment].drawEnd);
                const boundsEnd = thisTool._arc.clockwise
                  ? (thisTool._segmentAngles[runningSegment].drawEnd)
                  : (thisTool._segmentAngles[runningSegment].drawStart);
                const value = Math.min(Math.max(0, (runningSegmentAngle - boundsStart) / (boundsEnd - boundsStart)), 1);
                // 2022.07.03 Fixing lastcolor for true stop
                if (thisTool.config.show.style === 'colorstops') {
                  fill = thisTool._card._getGradientValue(
                    thisTool._segments.colorStops[thisTool._segments.sortedStops[runningSegment]],
                    thisTool._segments.colorStops[thisTool._segments.sortedStops[runningSegment]],
                    value,
                  );
                } else {
                  // 2022.07.12 Fix bug as this is no colorstops, but a colorlist!!!!
                  if (thisTool.config.show.style === 'colorlist') {
                    fill = thisTool.config.segments.colorlist.colors[runningSegment];
                  }
                }

                thisTool.styles.foreground[0].fill = fill;
                thisTool.as[0].style.fill = fill;

                if (runningSegment > 0) {
                  for (let j = runningSegment; j >= 0; j--) { // +1
                    if (thisTool.styles.foreground[j].fill != fill) {
                      thisTool.styles.foreground[j].fill = fill;
                      thisTool.as[j].style.fill = fill;
                    }
                    thisTool.styles.foreground[j].fill = fill;
                    thisTool.as[j].style.fill = fill;
                  }
                }
              }
            }
            thisTool._cache[runningSegment] = d;

            // If at end of animation, don't do the add to force going to next segment
            if (tween.frameAngle != runningSegmentAngle) {
              runningSegmentAngle += (0.000001 * thisTool._arc.direction);
            }

            var runningSegmentPrev = runningSegment;
            runningSegment = thisTool._segmentAngles.findIndex((currentValue, index) => (thisTool._arc.clockwise
              ? ((runningSegmentAngle <= currentValue.boundsEnd) && (runningSegmentAngle >= currentValue.boundsStart))
              : ((runningSegmentAngle <= currentValue.boundsStart) && (runningSegmentAngle >= currentValue.boundsEnd))));

            if (!increase) {
              if (runningSegmentPrev != runningSegment) {
                if (thisTool.debug) console.log('RENDERNEW movit - remove path', thisTool.toolId, runningSegmentPrev);
                if (thisTool._arc.clockwise) {
                  as.removeAttribute('d');
                  thisTool._cache[runningSegmentPrev] = null;
                } else {
                  as.removeAttribute('d');
                  thisTool._cache[runningSegmentPrev] = null;
                }
              }
            }
            tween.runningAngle = runningSegmentAngle;
            if (thisTool.debug) console.log('RENDERNEW - animation loop tween', thisTool.toolId, tween, runningSegment, runningSegmentPrev);
          } while ((tween.runningAngle != tween.frameAngle) /* && (runningSegment == runningSegmentPrev) */);

          // NTS @ 2020.10.14
          // In a fast paced animation - say 10msec - multiple segments should be drawn,
          //   while tween.progress already has the value of 1.
          // This means only the first segment is drawn - due to the "&& (runningSegment == runningSegmentPrev)" test above.
          // To fix this:
          // - either remove that test (why was it there????)... Or
          // - add the line "|| (runningSegment != runningSegmentPrev)" to the if() below to make sure another animation frame is requested
          //   although tween.progress == 1.
          if ((tween.progress != 1) /* || (runningSegment != runningSegmentPrev) */) {
            thisTool.rAFid = requestAnimationFrame((timestamp) => {
              animateSegmentsNEW(timestamp, thisTool);
            });
          } else {
            tween.startTime = null;
            if (thisTool.debug) console.log('RENDERNEW - animation loop ENDING tween', thisTool.toolId, tween, runningSegment, runningSegmentPrev);
          }
        } // function animateSegmentsNEW

        const mySelf = this;
        // 2021.10.31
        // Edge case where brightness percentage is set to undefined (attribute is gone) if light is set to off.
        // Now if light is switched on again, the brightness is set to old value, and val and valPrev are the same again, so NO drawing!!!!!
        //
        // Remove test for val/valPrev...

        // Check if values changed and we should animate to another target then previously rendered
        if (/* (val != valPrev) && */ (this._card.connected == true) && (this._renderTo != this._stateValue)) {
        // if ( (val != valPrev) && (this._card.connected == true) && (this._renderTo != this._stateValue)) {
          this._renderTo = this._stateValue;
          // if (this.dev.debug) console.log('RENDERNEW val != valPrev', val, valPrev, 'prev/end/cur', arcEndPrev, arcEnd, arcCur);

          // If previous animation active, cancel this one before starting a new one...
          if (this.rAFid) {
            // if (this.dev.debug) console.log('RENDERNEW canceling rAFid', this._card.cardId, this.toolId, 'rAFid', this.rAFid);
            cancelAnimationFrame(this.rAFid);
          }

          // Start new animation with calculated settings...
          // counter var not defined???
          // if (this.dev.debug) console.log('starting animationframe timer...', this._card.cardId, this.toolId, counter);
          tween.fromAngle = arcEndPrev;
          tween.toAngle = arcEnd;
          tween.runningAngle = arcEndPrev;

          // @2021.10.31
          // Handle edge case where - for some reason - arcEnd and arcEndPrev are equal.
          // Do NOT render anything in this case to prevent errors...

          // The check is removed temporarily. Brightness is again not shown for light. Still the same problem...

          {
            // Render like an idiot the first time. Performs MUCH better @first load then having a zillion animations...
            // NOt so heavy on an average PC, but my iPad and iPhone need some more time for this!

            tween.duration = Math.min(Math.max(this._initialDraw ? 100 : 500, this._initialDraw ? 16 : this.config.animation.duration * 1000), 5000);
            tween.startTime = null;
            if (this.dev.debug) console.log('RENDERNEW - tween', this.toolId, tween);
            // this._initialDraw = false;
            this.rAFid = requestAnimationFrame((timestamp) => {
              animateSegmentsNEW(timestamp, mySelf);
            });
            this._initialDraw = false;
          }
        }

        return svg`${svgItems}`;
      } else {
        // Initial FIRST draw.
        // What if we 'abuse' the animation to do this, and we just create empty elements.
        // Then we don't have to do difficult things.
        // Just set some values to 0 and 'force' a full animation...
        //
        // Hmm. Stuff is not yet rendered, so DOM objects don't exist yet. How can we abuse the
        // animation function to do the drawing then??
        // --> Can use firstUpdated perhaps?? That was the first render, then do the first actual draw??
        //

        if (this.dev.debug) console.log('RENDERNEW _arcId does NOT exist', this._arcId, this.toolId);

        // Create empty elements, so no problem in animation function. All path's exist...
        // An empty element has a width of 0!
        for (let i = 0; i < this._segmentAngles.length; i++) {
          d = this.buildArcPath(
            this._segmentAngles[i].drawStart,
            this._segmentAngles[i].drawEnd,
            this._arc.clockwise,
            this.svg.radiusX,
            this.svg.radiusY,
            this.config.isScale ? this.svg.width : 0,
          );

          this._cache[i] = d;

          // extra, set color from colorlist as a test
          let fill = this.config.color;
          if (this.config.show.style === 'colorlist') {
            fill = this.config.segments.colorlist.colors[i];
          }
          if (this.config.show.style === 'colorstops') {
            fill = this._segments.colorStops[this._segments.sortedStops[i]];
          }
          //                            style="${styleMap(this.config.styles.foreground)} fill: ${fill};"
          if (!this.styles.foreground) {
            this.styles.foreground = {};
          }
          if (!this.styles.foreground[i]) {
            this.styles.foreground[i] = Merge.mergeDeep(this.config.styles.foreground);
          }
          this.styles.foreground[i].fill = fill;

          // #WIP
          // Testing 'lastcolor'
          if (this.config.show.lastcolor) {
            if (i > 0) {
              for (let j = i - 1; j > 0; j--) {
                this.styles.foreground[j].fill = fill;
              }
            }
          }

          svgItems.push(svg`<path id="arc-segment-${this.toolId}-${i}" class="arc__segment"
                            style="${styleMap(this.styles.foreground[i])}"
                            d="${d}"
                            />`);
        }

        if (this.dev.debug) console.log('RENDERNEW - svgItems', svgItems, this._firstUpdatedCalled);
        return svg`${svgItems}`;
      }

    // END OF NEW METHOD OF RENDERING
    }
  }

  polarToCartesian(centerX, centerY, radiusX, radiusY, angleInDegrees) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;

    return {
      x: centerX + (radiusX * Math.cos(angleInRadians)),
      y: centerY + (radiusY * Math.sin(angleInRadians)),
    };
  }

  /*
   *
   * start = 10, end = 30, clockwise -> size is 20
   * start = 10, end = 30, anticlockwise -> size is (360 - 20) = 340
   *
   *
   */
  buildArcPath(argStartAngle, argEndAngle, argClockwise, argRadiusX, argRadiusY, argWidth) {
    const start = this.polarToCartesian(this.svg.cx, this.svg.cy, argRadiusX, argRadiusY, argEndAngle);
    const end = this.polarToCartesian(this.svg.cx, this.svg.cy, argRadiusX, argRadiusY, argStartAngle);
    const largeArcFlag = Math.abs(argEndAngle - argStartAngle) <= 180 ? '0' : '1';

    const sweepFlag = argClockwise ? '0' : '1';

    const cutoutRadiusX = argRadiusX - argWidth;
    const cutoutRadiusY = argRadiusY - argWidth;
    const start2 = this.polarToCartesian(this.svg.cx, this.svg.cy, cutoutRadiusX, cutoutRadiusY, argEndAngle);
    const end2 = this.polarToCartesian(this.svg.cx, this.svg.cy, cutoutRadiusX, cutoutRadiusY, argStartAngle);

    const d = [
      'M', start.x, start.y,
      'A', argRadiusX, argRadiusY, 0, largeArcFlag, sweepFlag, end.x, end.y,
      'L', end2.x, end2.y,
      'A', cutoutRadiusX, cutoutRadiusY, 0, largeArcFlag, sweepFlag == '0' ? '1' : '0', start2.x, start2.y,
      'Z',
    ].join(' ');
    return d;
  }
} // END of class

//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

// https://github.com/d3/d3-selection/blob/master/src/selection/data.js
//

/**
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

class SwissArmyKnifeCard extends LitElement {
  // card::constructor
  constructor() {
    super();

    this.connected = false;

    // Get cardId for unique SVG gradient Id
    this.cardId = Math.random().toString(36).substr(2, 9);
    this.entities = [];
    this.entitiesStr = [];
    this.attributesStr = [];
    this.secondaryInfoStr = [];
    this.viewBoxSize = SVG_VIEW_BOX;
    this.viewBox = { width: SVG_VIEW_BOX, height: SVG_VIEW_BOX };

    // Create the lists for the toolsets and the tools
    // - toolsets contain a list of toolsets with tools
    // - tools contain the full list of tools!
    this.toolsets = [];
    this.tools = [];

    // 2022.01.24
    // Add card styles functionality
    this.styles = {};
    this.styles.card = {};

    // For history query interval updates.
    this.entityHistory = {};
    this.entityHistory.needed = false;
    this.stateChanged = true;
    this.entityHistory.updating = false;
    this.entityHistory.update_interval = 300;
    // console.log("SAK Constructor,", this.entityHistory);

    // Development settings
    this.dev = {};
    this.dev.debug = false;
    this.dev.performance = false;
    this.dev.m3 = false;

    this.configIsSet = false;

    // Theme mode support
    this.theme = {};
    this.theme.modeChanged = false;
    this.theme.darkMode = false;

    // Safari is the new IE.
    // Check for iOS / iPadOS / Safari to be able to work around some 'features'
    // Some bugs are already 9 years old, and not fixed yet by Apple!
    //
    // However: there is a new SVG engine on its way that might be released in 2023.
    // That should fix a lot of problems, adhere to standards, allow for hardware
    // acceleration and mixing HTML - through the foreignObject - with SVG!
    //
    // The first small fixes are in 16.2-16.4, which is why I have to check for
    // Safari 16, as that version can use the same renderpath as Chrome and Firefox!! WOW!!
    //
    // Detection from: http://jsfiddle.net/jlubean/dL5cLjxt/
    //
    // this.isSafari = !!navigator.userAgent.match(/Version\/[\d\.]+.*Safari/);
    // this.iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    // See: https://javascriptio.com/view/10924/detect-if-device-is-ios
    // After iOS 13 you should detect iOS devices like this, since iPad will not be detected as iOS devices
    // by old ways (due to new "desktop" options, enabled by default)

    this.isSafari = !!navigator.userAgent.match(/Version\/[\d\.]+.*Safari/);
    this.iOS = (/iPad|iPhone|iPod/.test(navigator.userAgent)
                || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
                && !window.MSStream;
    this.isSafari14 = this.isSafari && /Version\/14\.[0-9]/.test(navigator.userAgent);
    this.isSafari15 = this.isSafari && /Version\/15\.[0-9]/.test(navigator.userAgent);
    this.isSafari16 = this.isSafari && /Version\/16\.[0-9]/.test(navigator.userAgent);
    this.isSafari16 = this.isSafari && /Version\/16\.[0-9]/.test(navigator.userAgent);

    // The iOS app does not use a standard agent string...
    // See: https://github.com/home-assistant/iOS/blob/master/Sources/Shared/API/HAAPI.swift
    // It contains strings like "like Safari" and "OS 14_2", and "iOS 14.2.0"

    this.isSafari14 = this.isSafari14 || /os 15.*like safari/.test(navigator.userAgent.toLowerCase());
    this.isSafari15 = this.isSafari15 || /os 14.*like safari/.test(navigator.userAgent.toLowerCase());
    this.isSafari16 = this.isSafari16 || /os 16.*like safari/.test(navigator.userAgent.toLowerCase());

    this.lovelace = SwissArmyKnifeCard.lovelace;

    if (!this.lovelace) {
      console.error("card::constructor - Can't get Lovelace panel");
      throw Error("card::constructor - Can't get Lovelace panel");
    }

    if (!SwissArmyKnifeCard.sakIconCache) {
      SwissArmyKnifeCard.sakIconCache = {};
    }
    if (!SwissArmyKnifeCard.colorCache) {
      SwissArmyKnifeCard.colorCache = [];
    }

    if (this.dev.debug) console.log('*****Event - card - constructor', this.cardId, new Date().getTime());
  }

  /** *****************************************************************************
  * Summary.
  * Implements the properties method
  *
  */
  /*
  static get properties() {
    return {
      hass: {},
      config: {},
      states: [],
      statesStr: [],

      dashArray: String,
      color1_offset: String,
      color0: String,
      color1: String,
      angleCoords: Object
    }
  }
*/
  static getSystemStyles() {
    return css`
      :host {
        cursor: default;
        font-size: ${FONT_SIZE}px;
      }

      /* Default settings for the card */
      /* - default cursor */
      /* - SVG overflow is not displayed, ie cutoff by the card edges */
      ha-card {
        cursor: default;
        overflow: hidden;
        
        -webkit-touch-callout: none;  
      }
      
      /* For disabled parts of tools/toolsets */
      /* - No input */
      ha-card.disabled {
        pointer-events: none;
        cursor: default;
      }

      .disabled {
        pointer-events: none !important;
        cursor: default !important;
      }

      /* For 'active' tools/toolsets */
      /* - Show cursor as pointer */
      .hover {
        cursor: pointer;
      }

      /* For hidden tools/toolsets where state for instance is undefined */
      .hidden {
        opacity: 0;
        visibility: hidden;
        transition: visibility 0s 1s, opacity 0.5s linear;
      }

      focus {
        outline: none;
      }
      focus-visible {
        outline: 3px solid blanchedalmond; /* That'll show 'em */
      }
      
      
      @media (print), (prefers-reduced-motion: reduce) {
        .animated {
          animation-duration: 1ms !important;
          transition-duration: 1ms !important;
          animation-iteration-count: 1 !important;
        }
      }

      
      /* Set default host font-size to 10 pixels.
       * In that case 1em = 10 pixels = 1% of 100x100 matrix used
       */
      @media screen and (min-width: 467px) {
        :host {
        font-size: ${FONT_SIZE}px;
        }
      }
      @media screen and (max-width: 466px) {
        :host {
        font-size: ${FONT_SIZE}px;
        }
      }

      :host ha-card {
            padding: 0px 0px 0px 0px;
      }

      .container {
        position: relative;
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      .labelContainer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 65%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
      }

      .ellipsis {
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
      }

      .state {
        position: relative;
        display: flex;
        flex-wrap: wrap;
        max-width: 100%;
        min-width: 0px;
      }

      #label {
        display: flex;
        line-height: 1;
      }

      #label.bold {
        font-weight: bold;
      }

      #label, #name {
        margin: 3% 0;
      }

      .shadow {
        font-size: 30px;
        font-weight: 700;
        text-anchor: middle;
      }

      .card--dropshadow-5 {
        filter: drop-shadow(0 1px 0 #ccc)
               drop-shadow(0 2px 0 #c9c9c9)
               drop-shadow(0 3px 0 #bbb)
               drop-shadow(0 4px 0 #b9b9b9)
               drop-shadow(0 5px 0 #aaa)
               drop-shadow(0 6px 1px rgba(0,0,0,.1))
               drop-shadow(0 0 5px rgba(0,0,0,.1))
               drop-shadow(0 1px 3px rgba(0,0,0,.3))
               drop-shadow(0 3px 5px rgba(0,0,0,.2))
               drop-shadow(0 5px 10px rgba(0,0,0,.25))
               drop-shadow(0 10px 10px rgba(0,0,0,.2))
               drop-shadow(0 20px 20px rgba(0,0,0,.15));
      }
      .card--dropshadow-medium--opaque--sepia90 {
        filter: drop-shadow(0.0em 0.05em 0px #b2a98f22)
                drop-shadow(0.0em 0.07em 0px #b2a98f55)
                drop-shadow(0.0em 0.10em 0px #b2a98f88)
                drop-shadow(0px 0.6em 0.9em rgba(0,0,0,0.15))
                drop-shadow(0px 1.2em 0.15em rgba(0,0,0,0.1))
                drop-shadow(0px 2.4em 2.5em rgba(0,0,0,0.1))
                sepia(90%);
      }

      .card--dropshadow-heavy--sepia90 {
        filter: drop-shadow(0.0em 0.05em 0px #b2a98f22)
                drop-shadow(0.0em 0.07em 0px #b2a98f55)
                drop-shadow(0.0em 0.10em 0px #b2a98f88)
                drop-shadow(0px 0.3em 0.45em rgba(0,0,0,0.5))
                drop-shadow(0px 0.6em 0.07em rgba(0,0,0,0.3))
                drop-shadow(0px 1.2em 1.25em rgba(0,0,0,1))
                drop-shadow(0px 1.8em 1.6em rgba(0,0,0,0.1))
                drop-shadow(0px 2.4em 2.0em rgba(0,0,0,0.1))
                drop-shadow(0px 3.0em 2.5em rgba(0,0,0,0.1))
                sepia(90%);
      }

      .card--dropshadow-heavy {
        filter: drop-shadow(0.0em 0.05em 0px #b2a98f22)
                drop-shadow(0.0em 0.07em 0px #b2a98f55)
                drop-shadow(0.0em 0.10em 0px #b2a98f88)
                drop-shadow(0px 0.3em 0.45em rgba(0,0,0,0.5))
                drop-shadow(0px 0.6em 0.07em rgba(0,0,0,0.3))
                drop-shadow(0px 1.2em 1.25em rgba(0,0,0,1))
                drop-shadow(0px 1.8em 1.6em rgba(0,0,0,0.1))
                drop-shadow(0px 2.4em 2.0em rgba(0,0,0,0.1))
                drop-shadow(0px 3.0em 2.5em rgba(0,0,0,0.1));
      }

      .card--dropshadow-medium--sepia90 {
        filter: drop-shadow(0.0em 0.05em 0px #b2a98f)
                drop-shadow(0.0em 0.15em 0px #b2a98f)
                drop-shadow(0.0em 0.15em 0px #b2a98f)
                drop-shadow(0px 0.6em 0.9em rgba(0,0,0,0.15))
                drop-shadow(0px 1.2em 0.15em rgba(0,0,0,0.1))
                drop-shadow(0px 2.4em 2.5em rgba(0,0,0,0.1))
                sepia(90%);
      }

      .card--dropshadow-medium {
        filter: drop-shadow(0.0em 0.05em 0px #b2a98f)
                drop-shadow(0.0em 0.15em 0px #b2a98f)
                drop-shadow(0.0em 0.15em 0px #b2a98f)
                drop-shadow(0px 0.6em 0.9em rgba(0,0,0,0.15))
                drop-shadow(0px 1.2em 0.15em rgba(0,0,0,0.1))
                drop-shadow(0px 2.4em 2.5em rgba(0,0,0,0.1));
      }

      .card--dropshadow-light--sepia90 {
        filter: drop-shadow(0px 0.10em 0px #b2a98f)
                drop-shadow(0.1em 0.5em 0.2em rgba(0, 0, 0, .5))
                sepia(90%);
      }

      .card--dropshadow-light {
        filter: drop-shadow(0px 0.10em 0px #b2a98f)
                drop-shadow(0.1em 0.5em 0.2em rgba(0, 0, 0, .5));
      }

      .card--dropshadow-down-and-distant {
        filter: drop-shadow(0px 0.05em 0px #b2a98f)
                drop-shadow(0px 14px 10px rgba(0,0,0,0.15))
                drop-shadow(0px 24px 2px rgba(0,0,0,0.1))
                drop-shadow(0px 34px 30px rgba(0,0,0,0.1));
      }
      
      .card--filter-none {
      }

      .horseshoe__svg__group {
        transform: translateY(15%);
      }

    `;
  }

  /** *****************************************************************************
  * card::getUserStyles()
  *
  * Summary.
  * Returns the user defined CSS styles for the card in sak_user_templates config
  * section in lovelace configuration.
  *
  */

  static getUserStyles() {
    this.userContent = '';

    if ((SwissArmyKnifeCard.lovelace.config.sak_user_templates)
        && (SwissArmyKnifeCard.lovelace.config.sak_user_templates.definitions.user_css_definitions)) {
      this.userContent = SwissArmyKnifeCard.lovelace.config.sak_user_templates.definitions.user_css_definitions.reduce((accumulator, currentValue) => accumulator + currentValue.content, '');
    }

    return css`${unsafeCSS(this.userContent)}`;
  }

  static getSakStyles() {
    this.sakContent = '';

    if ((SwissArmyKnifeCard.lovelace.config.sak_sys_templates)
        && (SwissArmyKnifeCard.lovelace.config.sak_sys_templates.definitions.sak_css_definitions)) {
      this.sakContent = SwissArmyKnifeCard.lovelace.config.sak_sys_templates.definitions.sak_css_definitions.reduce((accumulator, currentValue) => accumulator + currentValue.content, '');
    }

    return css`${unsafeCSS(this.sakContent)}`;
  }

  static getSakSvgDefinitions() {
    SwissArmyKnifeCard.lovelace.sakSvgContent = null;
    let sakSvgContent = '';

    if ((SwissArmyKnifeCard.lovelace.config.sak_sys_templates)
        && (SwissArmyKnifeCard.lovelace.config.sak_sys_templates.definitions.sak_svg_definitions)) {
      sakSvgContent = SwissArmyKnifeCard.lovelace.config.sak_sys_templates.definitions.sak_svg_definitions.reduce((accumulator, currentValue) => accumulator + currentValue.content, '');
    }
    // Cache result for later use in other cards
    SwissArmyKnifeCard.sakSvgContent = unsafeSVG(sakSvgContent);
  }

  static getUserSvgDefinitions() {
    SwissArmyKnifeCard.lovelace.userSvgContent = null;
    let userSvgContent = '';

    if ((SwissArmyKnifeCard.lovelace.config.sak_user_templates)
        && (SwissArmyKnifeCard.lovelace.config.sak_user_templates.definitions.user_svg_definitions)) {
      userSvgContent = SwissArmyKnifeCard.lovelace.config.sak_user_templates.definitions.user_svg_definitions.reduce((accumulator, currentValue) => accumulator + currentValue.content, '');
    }
    // Cache result for later use other cards
    SwissArmyKnifeCard.userSvgContent = unsafeSVG(userSvgContent);
  }

  /** *****************************************************************************
  * card::get styles()
  *
  * Summary.
  * Returns the static CSS styles for the lit-element
  *
  * Note:
  * - The BEM (http://getbem.com/naming/) naming style for CSS is used
  *   Of course, if no mistakes are made ;-)
  *
  * Note2:
  * - get styles is a static function and is called ONCE at initialization.
  *   So, we need to get lovelace here...
  */
  static get styles() {
    console.log('SAK - get styles');
    if (!SwissArmyKnifeCard.lovelace) SwissArmyKnifeCard.lovelace = Utils.getLovelace();

    if (!SwissArmyKnifeCard.lovelace) {
      console.error("SAK - Can't get reference to Lovelace");
      throw Error("card::get styles - Can't get Lovelace panel");
    }
    if (!SwissArmyKnifeCard.lovelace.config.sak_sys_templates) {
      console.error('SAK - System Templates reference NOT defined.');
      throw Error('card::get styles - System Templates reference NOT defined!');
    }
    if (!SwissArmyKnifeCard.lovelace.config.sak_user_templates) {
      console.warning('SAK - User Templates reference NOT defined. Did you NOT include them?');
    }

    // #TESTING
    // Testing dark/light mode support for future functionality
    // const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    // console.log('get styles', darkModeMediaQuery);
    // darkModeMediaQuery.addListener((e) => {
    // const darkModeOn = e.matches;
    // console.log(`Dark mode is ${darkModeOn ? '🌒 on' : '☀️ off'}.`);
    // });
    // console.log('get styles 2', darkModeMediaQuery);

    // Get - only ONCE - the external SVG definitions for both SAK and UserSvgTool
    // These definitions are cached into the static class of the card
    //
    // Note: If you change a view, and do a refresh (F5) everything is loaded.
    // But after that: HA asks you to refresh the page --> BAM, all Lovelace
    // cached data is gone. So we need a check/reload in a card...

    SwissArmyKnifeCard.getSakSvgDefinitions();
    SwissArmyKnifeCard.getUserSvgDefinitions();

    return css`
      ${SwissArmyKnifeCard.getSystemStyles()}
      ${SwissArmyKnifeCard.getSakStyles()}
      ${SwissArmyKnifeCard.getUserStyles()}
    `;
  }

  /** *****************************************************************************
  * card::set hass()
  *
  * Summary.
  * Updates hass data for the card
  *
  */

  set hass(hass) {
    if (!this.counter) this.counter = 0;
    this.counter++;

    // Check for theme mode and theme mode change...
    if (hass.themes.darkMode != this.theme.darkMode) {
      this.theme.darkMode = hass.themes.darkMode;
      this.theme.modeChanged = true;
    }

    // Set ref to hass, use "_"for the name ;-)
    if (this.dev.debug) console.log('*****Event - card::set hass', this.cardId, new Date().getTime());
    this._hass = hass;

    if (!this.connected) {
      if (this.dev.debug) console.log('set hass but NOT connected', this.cardId);

    // 2020.02.10 Troubles with connectcallback late, so windows are not yet calculated. ie
    // things around icons go wrong...
    // what if return is here..
      // return;
    }

    if (!this.config.entities) {
      return;
    }

    let entityHasChanged = false;

    // Update state strings and check for changes.
    // Only if changed, continue and force render
    let value;
    let index = 0;

    let secInfoSet = false;
    let newSecInfoState;
    let newSecInfoStateStr;

    let attrSet = false;
    let newStateStr;
    for (value of this.config.entities) {
      this.entities[index] = hass.states[this.config.entities[index].entity];

      if (this.entities[index] === undefined) {
        console.error('SAK - set hass, entity undefined: ', this.config.entities[index].entity);
        // Temp disable throw Error(`Set hass, entity undefined: ${this.config.entities[index].entity}`);
      }

      // Get secondary info state if specified and available
      if (this.config.entities[index].secondary_info) {
        secInfoSet = true;
        newSecInfoState = this.entities[index][this.config.entities[index].secondary_info];
        newSecInfoStateStr = this._buildSecondaryInfo(newSecInfoState, this.config.entities[index]);

        if (newSecInfoStateStr != this.secondaryInfoStr[index]) {
          this.secondaryInfoStr[index] = newSecInfoStateStr;
          entityHasChanged = true;
        }
      }

      // Get attribute state if specified and available
      if (this.config.entities[index].attribute) {
        // #WIP:
        // Check for indexed or mapped attributes, like weather forecast (array of 5 days with a map containing attributes)....
        //
        // states['weather.home'].attributes['forecast'][0].detailed_description
        // attribute: forecast[0].condition
        //

        let { attribute } = this.config.entities[index];
        let attrMore = '';
        let attributeState = '';

        const arrayPos = this.config.entities[index].attribute.indexOf('[');
        const dotPos = this.config.entities[index].attribute.indexOf('.');
        let arrayIdx = 0;
        let arrayMap = '';

        if (arrayPos != -1) {
          // We have an array. Split...
          attribute = this.config.entities[index].attribute.substr(0, arrayPos);
          attrMore = this.config.entities[index].attribute.substr(arrayPos, this.config.entities[index].attribute.length - arrayPos);

          // Just hack, assume single digit index...
          arrayIdx = attrMore[1];
          arrayMap = attrMore.substr(4, attrMore.length - 4);

          // Fetch state
          attributeState = this.entities[index].attributes[attribute][arrayIdx][arrayMap];
          // console.log('set hass, attributes with array/map', this.config.entities[index].attribute, attribute, attrMore, arrayIdx, arrayMap, attributeState);
        } else if (dotPos != -1) {
          // We have a map. Split...
          attribute = this.config.entities[index].attribute.substr(0, dotPos);
          attrMore = this.config.entities[index].attribute.substr(arrayPos, this.config.entities[index].attribute.length - arrayPos);
          arrayMap = attrMore.substr(1, attrMore.length - 1);

          // Fetch state
          attributeState = this.entities[index].attributes[attribute][arrayMap];

          console.log('set hass, attributes with map', this.config.entities[index].attribute, attribute, attrMore);
        } else {
          // default attribute handling...
          attributeState = this.entities[index].attributes[attribute];
        }

        { // (typeof attributeState != 'undefined') {
          newStateStr = this._buildState(attributeState, this.config.entities[index]);
          if (newStateStr != this.attributesStr[index]) {
            this.attributesStr[index] = newStateStr;
            entityHasChanged = true;
          }
          attrSet = true;
        }
        // 2021.10.30
        // Due to change in light percentage, check for undefined.
        // If bulb is off, NO percentage is given anymore, so is probably 'undefined'.
        // Any tool should still react to a percentage going from a valid value to undefined!
      }
      if ((!attrSet) && (!secInfoSet)) {
        newStateStr = this._buildState(this.entities[index].state, this.config.entities[index]);
        if (newStateStr != this.entitiesStr[index]) {
          this.entitiesStr[index] = newStateStr;
          entityHasChanged = true;
        }
        if (this.dev.debug) console.log('set hass - attrSet=false', this.cardId, `${new Date().getSeconds().toString()}.${new Date().getMilliseconds().toString()}`, newStateStr);
      }

      index++;
      attrSet = false;
      secInfoSet = false;
    }

    if ((!entityHasChanged) && (!this.theme.modeChanged)) {
      // console.timeEnd("--> " + this.cardId + " PERFORMANCE card::hass");

      return;
    }

    // Either one of the entities has changed, or the theme mode. So update all toolsets with new data.
    if (this.toolsets) {
      this.toolsets.map((item, index) => {
        item.updateValues();
      });
    }

    // Always request update to render the card if any of the states, attributes or theme mode have changed...

    this.requestUpdate();

    // An update has been requested to recalculate / redraw the tools, so reset theme mode changed
    this.theme.modeChanged = false;

    this.counter--;

    // console.timeEnd("--> " + this.cardId + " PERFORMANCE card::hass");
  }

  /** *****************************************************************************
  * card::setConfig()
  *
  * Summary.
  * Sets/Updates the card configuration. Rarely called if the doc is right
  *
  */

  setConfig(config) {
    if (this.dev.performance) console.time(`--> ${this.cardId} PERFORMANCE card::setConfig`);

    if (this.dev.debug) console.log('*****Event - setConfig', this.cardId, new Date().getTime());
    config = JSON.parse(JSON.stringify(config));

    if (config.dev) this.dev = { ...this.dev, ...config.dev };

    if (this.dev.debug) console.log('setConfig', this.cardId);

    if (!config.layout) {
      throw Error('card::setConfig - No layout defined');
    }

    // Temp disable for layout template check...
    // if (!config.layout.toolsets) {
    // throw Error('card::setConfig - No toolsets defined');
    // }

    // testing
    if (config.entities) {
      const newdomain = this._computeDomain(config.entities[0].entity);
      if (newdomain != 'sensor') {
        // If not a sensor, check if attribute is a number. If so, continue, otherwise Error...
        if (config.entities[0].attribute && !isNaN(config.entities[0].attribute)) {
          throw Error('card::setConfig - First entity or attribute must be a numbered sensorvalue, but is NOT');
        }
      }
    }

    // Copy config, as we must have write access to replace templates!
    const newConfig = Merge.mergeDeep(config);

    // #TODO must be removed after removal of segmented arcs part below
    this.config = newConfig;

    // NEW for ts processing
    this.toolset = [];

    const thisMe = this;
    function findTemplate(key, value) {
      // Filtering out properties
      // console.log("findTemplate, key=", key, "value=", value);
      if (value?.template) {
        const template = thisMe.lovelace.config.sak_user_templates.templates[value.template.name];
        if (!template)
          console.error('Template not found...', value.template, template);

        const replacedValue = Templates.replaceVariables3(value.template.variables, template);
        // Hmm. cannot add .template var. object is not extensible...
        // replacedValue.template = 'replaced';
        const secondValue = Merge.mergeDeep(replacedValue);
        // secondValue.from_template = 'replaced';

        return secondValue;
      }
      if (key == 'template') {
        // Template is gone via replace!!!! No template anymore, as there is no merge done.
        console.log('findTemplate return key=template/value', key, undefined);

        return value;
      }
      // console.log("findTemplate return key/value", key, value);
      return value;
    }

    // Find & Replace template definitions. This also supports layout templates
    const cfg = JSON.stringify(this.config, findTemplate);

    // To further process toolset templates, get reference to toolsets
    const cfgobj = JSON.parse(cfg).layout.toolsets;

    // Set layout template if found
    if (this.config.layout.template) {
      this.config.layout = JSON.parse(cfg).layout;
    }

    // Continue to check & replace partial toolset templates and overrides
    this.config.layout.toolsets.map((toolsetCfg, toolidx) => {
      let toolList = null;

      if (!this.toolsets) this.toolsets = [];

      {
        let found = false;
        let toolAdd = [];

        toolList = cfgobj[toolidx].tools;
        // Check for empty tool list. This can be if template is used. Tools come from template, not from config...
        if (toolsetCfg.tools) {
          toolsetCfg.tools.map((tool, index) => {
            cfgobj[toolidx].tools.map((toolT, indexT) => {
              if (tool.id == toolT.id) {
                if (toolsetCfg.template) {
                  if (this.config.layout.toolsets[toolidx].position)
                    cfgobj[toolidx].position = Merge.mergeDeep(this.config.layout.toolsets[toolidx].position);

                  toolList[indexT] = Merge.mergeDeep(toolList[indexT], tool);

                  // After merging/replacing. We might get some template definitions back!!!!!!
                  toolList[indexT] = JSON.parse(JSON.stringify(toolList[indexT], findTemplate));

                  found = true;
                }
                if (this.dev.debug) console.log('card::setConfig - got toolsetCfg toolid', tool, index, toolT, indexT, tool);
              }
              cfgobj[toolidx].tools[indexT] = Templates.getJsTemplateOrValueConfig(cfgobj[toolidx].tools[indexT], Merge.mergeDeep(cfgobj[toolidx].tools[indexT]));
            });
            if (!found) toolAdd = toolAdd.concat(toolsetCfg.tools[index]);
          });
        }
        toolList = toolList.concat(toolAdd);
      }

      toolsetCfg = cfgobj[toolidx];
      const newToolset = new Toolset(this, toolsetCfg);
      this.toolsets.push(newToolset);
    });

    // Special case. Abuse card for m3 conversion to output
    if (this.dev.m3) {
      console.log('*** M3 - Checking for m3.yaml template to convert...');

      if (this.lovelace.config.sak_user_templates.templates.m3) {
        const { m3 } = this.lovelace.config.sak_user_templates.templates;

        console.log('*** M3 - Found. Material 3 conversion starting...');
        let palette = '';
        let colordefault = '';
        let colorlight = '';
        let colordark = '';

        let surfacelight = '';
        let primarylight = '';
        let neutrallight = '';

        let surfacedark = '';
        let primarydark = '';
        let neutraldark = '';

        const colorEntities = {};
        const cssNames = {};
        const cssNamesRgb = {};

        m3.entities.map((entity, index) => {
          if (['ref.palette', 'sys.color', 'sys.color.light', 'sys.color.dark'].includes(entity.category_id)) {
            if (!entity.tags.includes('alias')) {
              colorEntities[entity.id] = { value: entity.value, tags: entity.tags };
            }
          }

          if (entity.category_id === 'ref.palette') {
            palette += `${entity.id}: '${entity.value}'\n`;

            // test for primary light color...
            if (entity.id === 'md.ref.palette.primary40') {
              primarylight = entity.value;
            }
            // test for primary dark color...
            if (entity.id === 'md.ref.palette.primary80') {
              primarydark = entity.value;
            }

            // test for neutral light color...
            if (entity.id === 'md.ref.palette.neutral40') {
              neutrallight = entity.value;
            }
            // test for neutral light color...
            if (entity.id === 'md.ref.palette.neutral80') {
              neutraldark = entity.value;
            }
          }

          if (entity.category_id === 'sys.color') {
            colordefault += `${entity.id}: '${entity.value}'\n`;
          }

          if (entity.category_id === 'sys.color.light') {
            colorlight += `${entity.id}: '${entity.value}'\n`;

            // test for surface light color...
            if (entity.id === 'md.sys.color.surface.light') {
              surfacelight = entity.value;
            }
          }

          if (entity.category_id === 'sys.color.dark') {
            colordark += `${entity.id}: '${entity.value}'\n`;

            // test for surface light color...
            if (entity.id === 'md.sys.color.surface.dark') {
              surfacedark = entity.value;
            }
          }
        });

        ['primary', 'secondary', 'tertiary', 'error', 'neutral', 'neutral-variant'].forEach((palette) => {
          [5, 15, 25, 35, 45, 65, 75, 85].forEach((step) => {
            colorEntities[`md.ref.palette.${palette}${step.toString()}`] = {
              value: this._getGradientValue(
                colorEntities[`md.ref.palette.${palette}${(step - 5).toString()}`].value,
                colorEntities[`md.ref.palette.${palette}${(step + 5).toString()}`].value,
                0.5,
              ),
              tags: [...colorEntities[`md.ref.palette.${palette}${(step - 5).toString()}`].tags],
            };
            colorEntities[`md.ref.palette.${palette}${step.toString()}`].tags[3] = palette + step.toString();
          });
          colorEntities[`md.ref.palette.${palette}7`] = {
            value: this._getGradientValue(
              colorEntities[`md.ref.palette.${palette}5`].value,
              colorEntities[`md.ref.palette.${palette}10`].value,
              0.5,
            ),
            tags: [...colorEntities[`md.ref.palette.${palette}10`].tags],
          };
          colorEntities[`md.ref.palette.${palette}7`].tags[3] = `${palette}7`;

          colorEntities[`md.ref.palette.${palette}92`] = {
            value: this._getGradientValue(
              colorEntities[`md.ref.palette.${palette}90`].value,
              colorEntities[`md.ref.palette.${palette}95`].value,
              0.5,
            ),
            tags: [...colorEntities[`md.ref.palette.${palette}90`].tags],
          };
          colorEntities[`md.ref.palette.${palette}92`].tags[3] = `${palette}92`;

          colorEntities[`md.ref.palette.${palette}97`] = {
            value: this._getGradientValue(
              colorEntities[`md.ref.palette.${palette}95`].value,
              colorEntities[`md.ref.palette.${palette}99`].value,
              0.5,
            ),
            tags: [...colorEntities[`md.ref.palette.${palette}90`].tags],
          };
          colorEntities[`md.ref.palette.${palette}97`].tags[3] = `${palette}97`;
        });

        for (const [index, entity] of Object.entries(colorEntities)) {
          cssNames[index] = `theme-${entity.tags[1]}-${entity.tags[2]}-${entity.tags[3]}: rgb(${hex2rgb(entity.value)})`;
          cssNamesRgb[index] = `theme-${entity.tags[1]}-${entity.tags[2]}-${entity.tags[3]}-rgb: ${hex2rgb(entity.value)}`;
        }

        // https://filosophy.org/code/online-tool-to-lighten-color-without-alpha-channel/

        function hex2rgb(hexColor) {
          const rgbCol = {};

          rgbCol.r = Math.round(parseInt(hexColor.substr(1, 2), 16));
          rgbCol.g = Math.round(parseInt(hexColor.substr(3, 2), 16));
          rgbCol.b = Math.round(parseInt(hexColor.substr(5, 2), 16));

          // const cssRgbColor = "rgb(" + rgbCol.r + "," + rgbCol.g + "," + rgbCol.b + ")";
          const cssRgbColor = `${rgbCol.r},${rgbCol.g},${rgbCol.b}`;
          return cssRgbColor;
        }

        function getSurfaces(surfaceColor, paletteColor, opacities, cssName, mode) {
          const bgCol = {};
          const fgCol = {};

          bgCol.r = Math.round(parseInt(surfaceColor.substr(1, 2), 16));
          bgCol.g = Math.round(parseInt(surfaceColor.substr(3, 2), 16));
          bgCol.b = Math.round(parseInt(surfaceColor.substr(5, 2), 16));

          fgCol.r = Math.round(parseInt(paletteColor.substr(1, 2), 16));
          fgCol.g = Math.round(parseInt(paletteColor.substr(3, 2), 16));
          fgCol.b = Math.round(parseInt(paletteColor.substr(5, 2), 16));

          let surfaceColors = '';
          let r; let g; let b;
          opacities.forEach((opacity, index) => {
            r = Math.round(opacity * fgCol.r + (1 - opacity) * bgCol.r);
            g = Math.round(opacity * fgCol.g + (1 - opacity) * bgCol.g);
            b = Math.round(opacity * fgCol.b + (1 - opacity) * bgCol.b);

            surfaceColors += `${cssName + (index + 1).toString()}-${mode}: rgb(${r},${g},${b})\n`;
            surfaceColors += `${cssName + (index + 1).toString()}-${mode}-rgb: ${r},${g},${b}\n`;
          });

          return surfaceColors;
        }

        // Generate surfaces for dark and light...
        const opacitysurfacelight = [0.03, 0.05, 0.08, 0.11, 0.15, 0.19, 0.24, 0.29, 0.35, 0.4];
        const opacitysurfacedark = [0.05, 0.08, 0.11, 0.15, 0.19, 0.24, 0.29, 0.35, 0.40, 0.45];

        const surfacenL = getSurfaces(surfacelight, neutrallight, opacitysurfacelight, '  theme-ref-elevation-surface-neutral', 'light');

        const neutralvariantlight = colorEntities['md.ref.palette.neutral-variant40'].value;
        const surfacenvL = getSurfaces(surfacelight, neutralvariantlight, opacitysurfacelight, '  theme-ref-elevation-surface-neutral-variant', 'light');

        const surfacepL = getSurfaces(surfacelight, primarylight, opacitysurfacelight, '  theme-ref-elevation-surface-primary', 'light');

        const secondarylight = colorEntities['md.ref.palette.secondary40'].value;
        const surfacesL = getSurfaces(surfacelight, secondarylight, opacitysurfacelight, '  theme-ref-elevation-surface-secondary', 'light');

        const tertiarylight = colorEntities['md.ref.palette.tertiary40'].value;
        const surfacetL = getSurfaces(surfacelight, tertiarylight, opacitysurfacelight, '  theme-ref-elevation-surface-tertiary', 'light');

        const errorlight = colorEntities['md.ref.palette.error40'].value;
        const surfaceeL = getSurfaces(surfacelight, errorlight, opacitysurfacelight, '  theme-ref-elevation-surface-error', 'light');

        // DARK
        const surfacenD = getSurfaces(surfacedark, neutraldark, opacitysurfacedark, '  theme-ref-elevation-surface-neutral', 'dark');

        const neutralvariantdark = colorEntities['md.ref.palette.neutral-variant80'].value;
        const surfacenvD = getSurfaces(surfacedark, neutralvariantdark, opacitysurfacedark, '  theme-ref-elevation-surface-neutral-variant', 'dark');

        const surfacepD = getSurfaces(surfacedark, primarydark, opacitysurfacedark, '  theme-ref-elevation-surface-primary', 'dark');

        const secondarydark = colorEntities['md.ref.palette.secondary80'].value;
        const surfacesD = getSurfaces(surfacedark, secondarydark, opacitysurfacedark, '  theme-ref-elevation-surface-secondary', 'dark');

        const tertiarydark = colorEntities['md.ref.palette.tertiary80'].value;
        const surfacetD = getSurfaces(surfacedark, tertiarydark, opacitysurfacedark, '  theme-ref-elevation-surface-tertiary', 'dark');

        const errordark = colorEntities['md.ref.palette.error80'].value;
        const surfaceeD = getSurfaces(surfacedark, errordark, opacitysurfacedark, '  theme-ref-elevation-surface-error', 'dark');

        let themeDefs = '';
        for (const [index, cssName] of Object.entries(cssNames)) { // lgtm[js/unused-local-variable]
          if (cssName.substring(0, 9) == 'theme-ref') {
            themeDefs += `  ${cssName}\n`;
            themeDefs += `  ${cssNamesRgb[index]}\n`;
          }
        }
        // Dump full theme contents to console.
        // User should copy this content into the theme definition YAML file.
        console.log(surfacenL + surfacenvL + surfacepL + surfacesL + surfacetL + surfaceeL
                    + surfacenD + surfacenvD + surfacepD + surfacesD + surfacetD + surfaceeD
                    + themeDefs);

        console.log('*** M3 - Material 3 conversion DONE. You should copy the above output...');
      }
    }

    // Get aspectratio. This can be defined at card level or layout level
    this.aspectratio = (this.config.layout.aspectratio || this.config.aspectratio || '1/1').trim();

    const ar = this.aspectratio.split('/');
    if (!this.viewBox) this.viewBox = {};
    this.viewBox.width = ar[0] * SVG_DEFAULT_DIMENSIONS;
    this.viewBox.height = ar[1] * SVG_DEFAULT_DIMENSIONS;

    if (this.config.layout.styles?.card) {
      this.styles.card = this.config.layout.styles.card;
    }

    if (this.dev.debug) console.log('Step 5: toolconfig, list of toolsets', this.toolsets);
    if (this.dev.debug) console.log('debug - setConfig', this.cardId, this.config);
    if (this.dev.performance) console.timeEnd(`--> ${this.cardId} PERFORMANCE card::setConfig`);

    this.configIsSet = true;
  }

  /** *****************************************************************************
  * card::connectedCallback()
  *
  * Summary.
  *
  */
  connectedCallback() {
    if (this.dev.performance) console.time(`--> ${this.cardId} PERFORMANCE card::connectedCallback`);

    if (this.dev.debug) console.log('*****Event - connectedCallback', this.cardId, new Date().getTime());
    this.connected = true;
    super.connectedCallback();

    if (this.entityHistory.update_interval) {
      // Fix crash while set hass not yet called, and thus no access to entities!
      this.updateOnInterval();
      // #TODO, modify to total interval
      // Use fast interval at start, and normal interval after that, if _hass is defined...
      clearInterval(this.interval);
      this.interval = setInterval(
        () => this.updateOnInterval(),
        this._hass ? this.entityHistory.update_interval * 1000 : 1000,
      );
    }
    if (this.dev.debug) console.log('ConnectedCallback', this.cardId);

    // MUST request updates again, as no card is displayed otherwise as long as there is no data coming in...
    this.requestUpdate();
    if (this.dev.performance) console.timeEnd(`--> ${this.cardId} PERFORMANCE card::connectedCallback`);
  }

  /** *****************************************************************************
  * card::disconnectedCallback()
  *
  * Summary.
  *
  */
  disconnectedCallback() {
    if (this.dev.performance) console.time(`--> ${this.cardId} PERFORMANCE card::disconnectedCallback`);

    if (this.dev.debug) console.log('*****Event - disconnectedCallback', this.cardId, new Date().getTime());
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = 0;
    }
    super.disconnectedCallback();
    if (this.dev.debug) console.log('disconnectedCallback', this.cardId);
    this.connected = false;
    if (this.dev.performance) console.timeEnd(`--> ${this.cardId} PERFORMANCE card::disconnectedCallback`);
  }

  /** *****************************************************************************
  * card::firstUpdated()
  *
  * Summary.
  * firstUpdated fires after the first time the card hs been updated using its render method,
  * but before the browser has had a chance to paint.
  *
  */

  firstUpdated(changedProperties) {
    if (this.dev.debug) console.log('*****Event - card::firstUpdated', this.cardId, new Date().getTime());

    if (this.toolsets) {
      this.toolsets.map(async (item, index) => {
        item.firstUpdated(changedProperties);
      });
    }
  }

  /** *****************************************************************************
  * card::updated()
  *
  * Summary.
  *
  */
  updated(changedProperties) {
    if (this.dev.debug) console.log('*****Event - Updated', this.cardId, new Date().getTime());

    if (this.toolsets) {
      this.toolsets.map(async (item, index) => {
        item.updated(changedProperties);
      });
    }
  }

  /** *****************************************************************************
  * card::render()
  *
  * Summary.
  * Renders the complete SVG based card according to the specified layout.
  *
  * render ICON TESTING pathh lzwzmegla undefined undefined
  * render ICON TESTING pathh lzwzmegla undefined NodeList [ha-svg-icon]
  * render ICON TESTING pathh lzwzmegla M7,2V13H10V22L17,10H13L17,2H7Z NodeList [ha-svg-icon]
  */

  render() {
    if (this.dev.performance) console.time(`--> ${this.cardId} PERFORMANCE card::render`);
    if (this.dev.debug) console.log('*****Event - render', this.cardId, new Date().getTime());

    if (!this.connected) {
      if (this.dev.debug) console.log('render but NOT connected', this.cardId, new Date().getTime());
      return;
    }

    let myHtml;

    try {
      if (this.config.disable_card) {
        myHtml = html`
                  <div class="container" id="container">
                    ${this._renderSvg()}
                  </div>
                  `;
      } else {
        myHtml = html`
                  <ha-card style="${styleMap(this.styles.card)}">
                    <div class="container" id="container" 
                    >
                      ${this._renderSvg()}
                    </div>
                  </ha-card>
                  `;
      }
    } catch (error) {
      console.error(error);
    }
    if (this.dev.performance) console.timeEnd(`--> ${this.cardId} PERFORMANCE card::render`);

    return myHtml;
  }

  _renderSakSvgDefinitions() {
    return svg`
    ${SwissArmyKnifeCard.sakSvgContent}
    `;
  }

  _renderUserSvgDefinitions() {
    return svg`
    ${SwissArmyKnifeCard.userSvgContent}
    `;
  }

  themeIsDarkMode() {
    return (this.theme.darkMode == true);
  }

  themeIsLightMode() {
    return (this.theme.darkMode == false);
  }

  /** *****************************************************************************
  * card::_RenderToolsets()
  *
  * Summary.
  * Renders the toolsets
  *
  */

  _RenderToolsets() {
    if (this.dev.debug) console.log('all the tools in renderTools', this.tools);

    return svg`
              <g id="toolsets" class="toolsets__group"
              >
                ${this.toolsets.map((toolset) => toolset.render())}
              </g>

            <defs>
              ${this._renderSakSvgDefinitions()}
              ${this._renderUserSvgDefinitions()}
            </defs>
    `;
  }

  /** *****************************************************************************
  * card::_renderSvg()
  *
  * Summary.
  * Renders the SVG
  *
  * NTS:
  * If height and width given for svg it equals the viewbox. The card is not scaled
  * anymore to the full dimensions of the card given by hass/lovelace.
  * Card or svg is also placed default at start of viewport (not box), and can be
  * placed at start, center or end of viewport (Use align-self to center it).
  *
  * 1.  If height and width are ommitted, the ha-card/viewport is forced to the x/y
  *     aspect ratio of the viewbox, ie 1:1. EXACTLY WHAT WE WANT!
  * 2.  If height and width are set to 100%, the viewport (or ha-card) forces the
  *     aspect-ratio on the svg. Although GetCardSize is set to 4, it seems the
  *     height is forced to 150px, so part of the viewbox/svg is not shown or
  *     out of proportion!
  *
  */

  _renderCardAttributes() {
    let entityValue;
    const attributes = [];

    this._attributes = '';

    for (let i = 0; i < this.entities.length; i++) {
      entityValue = this.attributesStr[i]
        ? this.attributesStr[i]
        : this.secondaryInfoStr[i]
          ? this.secondaryInfoStr[i]
          : this.entitiesStr[i];
      attributes.push(entityValue);
    }
    this._attributes = attributes;
    return attributes;
  }

  _renderSvg() {
    const cardFilter = this.config.card_filter ? this.config.card_filter : 'card--filter-none';

    const svgItems = [];

    // The extra group is required for Safari to have filters work and updates are rendered.
    // If group omitted, some cards do update, and some not!!!! Don't ask why!
    // style="${styleMap(this.styles.card)}"

    this._renderCardAttributes();

    // @2022.01.26 Timing / Ordering problem:
    // - the _RenderToolsets() function renders tools, which build the this.styles/this.classes maps.
    // - However: this means that higher styles won't render until the next render, ie this.styles.card
    //   won't render, as this variable is already cached as it seems by Polymer.
    // - This is also the case for this.styles.tools/toolsets: they also don't work!
    //
    // Fix for card styles: render toolsets first, and then push the svg data!!

    const toolsetsSvg = this._RenderToolsets();

    svgItems.push(svg`
      <svg id="rootsvg" xmlns="http://www/w3.org/2000/svg" xmlns:xlink="http://www/w3.org/1999/xlink"
       class="${cardFilter}"
       style="${styleMap(this.styles.card)}"
       data-entity-0="${this._attributes[0]}"
       data-entity-1="${ifDefined(this._attributes[1])}"
       data-entity-2="${ifDefined(this._attributes[2])}"
       data-entity-3="${ifDefined(this._attributes[3])}"
       data-entity-4="${ifDefined(this._attributes[4])}"
       data-entity-5="${ifDefined(this._attributes[5])}"
       data-entity-6="${ifDefined(this._attributes[6])}"
       data-entity-7="${ifDefined(this._attributes[7])}"
       data-entity-8="${ifDefined(this._attributes[8])}"
       data-entity-9="${ifDefined(this._attributes[9])}"
       viewBox="0 0 ${this.viewBox.width} ${this.viewBox.height}"
      >
        <g style="${styleMap(this.config.layout?.styles?.toolsets)}">
          ${toolsetsSvg}
        </g>
    </svg>`);

    return svg`${svgItems}`;
  }

  /** *****************************************************************************
  * card::_buildUom()
  *
  * Summary.
  * Builds the Unit of Measurement string.
  *
  */

  _buildUom(derivedEntity, entityState, entityConfig) {
    return (
      derivedEntity?.unit
      || entityConfig?.unit
      || entityState?.attributes.unit_of_measurement
      || ''
    );
  }

  toLocale(string, fallback = 'unknown') {
    const lang = this._hass.selectedLanguage || this._hass.language;
    const resources = this._hass.resources[lang];
    return (resources && resources[string] ? resources[string] : fallback);
  }

  /** *****************************************************************************
  * card::_buildState()
  *
  * Summary.
  * Builds the State string.
  * If state is not a number, the state is returned AS IS, otherwise the state
  * is build according to the specified number of decimals.
  *
  * NOTE:
  * - a number value of "-0" is translated to "0". The sign is gone...
  */

  _buildState(inState, entityConfig) {
    // console.log('_buildState', inState, entityConfig)

    if (isNaN(inState)) {
      if (inState === 'unavailable') return '-ua-';
      return inState;
    }

    if (entityConfig.format === 'brightness') {
      return `${Math.round((inState / 255) * 100)}`;
    }

    const state = Math.abs(Number(inState));
    const sign = Math.sign(inState);

    if (['0', '-0'].includes(sign)) return sign;

    if (entityConfig.decimals === undefined || Number.isNaN(entityConfig.decimals) || Number.isNaN(state))
      return (sign == '-1' ? `-${(Math.round(state * 100) / 100).toString()}` : (Math.round(state * 100) / 100).toString());

    const x = 10 ** entityConfig.decimals;
    return (sign == '-1' ? `-${(Math.round(state * x) / x).toFixed(entityConfig.decimals).toString()}`
      : (Math.round(state * x) / x).toFixed(entityConfig.decimals).toString());
  }

  /** *****************************************************************************
  * card::_buildSecondaryInfo()
  *
  * Summary.
  * Builds the SecondaryInfo string.
  *
  */

  _buildSecondaryInfo(inSecInfoState, entityConfig) {
    const leftPad = (num) => (num < 10 ? `0${num}` : num);

    function secondsToDuration(d) {
      const h = Math.floor(d / 3600);
      const m = Math.floor((d % 3600) / 60);
      const s = Math.floor((d % 3600) % 60);

      if (h > 0) {
        return `${h}:${leftPad(m)}:${leftPad(s)}`;
      }
      if (m > 0) {
        return `${m}:${leftPad(s)}`;
      }
      if (s > 0) {
        return `${s}`;
      }
      return null;
    }

    const lang = this._hass.selectedLanguage || this._hass.language;

    // this.polyfill(lang);

    if (['relative', 'total', 'date', 'time', 'datetime'].includes(entityConfig.format)) {
      const timestamp = new Date(inSecInfoState);
      if (!(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
        return inSecInfoState;
      }

      let retValue;
      // return date/time according to formatting...
      switch (entityConfig.format) {
        case 'relative':
          const diff = selectUnit(timestamp, new Date());
          retValue = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(diff.value, diff.unit);
          break;
        case 'total':
        case 'precision':
          retValue = 'Not Yet Supported';
          break;
        case 'date':
          retValue = new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'numeric', day: 'numeric' }).format(timestamp);
          break;
        case 'time':
          retValue = new Intl.DateTimeFormat(lang, { hour: 'numeric', minute: 'numeric', second: 'numeric' }).format(timestamp);
          break;
        case 'datetime':
          retValue = new Intl.DateTimeFormat(lang, {
            year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
          }).format(timestamp);
          break;
      }
      return retValue;
    }

    if (isNaN(parseFloat(inSecInfoState)) || !isFinite(inSecInfoState)) {
      return inSecInfoState;
    }
    if (entityConfig.format === 'brightness') {
      return `${Math.round((inSecInfoState / 255) * 100)} %`;
    }
    if (entityConfig.format === 'duration') {
      return secondsToDuration(inSecInfoState);
    }
  }

  /** *****************************************************************************
  * card::_computeState()
  *
  * Summary.
  *
  */

  _computeState(inState, dec) {
    if (isNaN(inState))
      return inState;

    const state = Number(inState);

    if (dec === undefined || Number.isNaN(dec) || Number.isNaN(state))
      return Math.round(state * 100) / 100;

    const x = 10 ** dec;
    return (Math.round(state * x) / x).toFixed(dec);
  }

  /** *****************************************************************************
  * card::_calculateColor()
  *
  * Summary.
  *
  * #TODO:
  * replace by TinyColor library? Is that possible/feasible??
  *
  */

  _calculateColor(argState, argStops, argIsGradient) {
    const sortedStops = Object.keys(argStops).map((n) => Number(n)).sort((a, b) => a - b);

    let start; let end; let
      val;
    const l = sortedStops.length;

    if (argState <= sortedStops[0]) {
      return argStops[sortedStops[0]];
    } else if (argState >= sortedStops[l - 1]) {
      return argStops[sortedStops[l - 1]];
    } else {
      for (let i = 0; i < l - 1; i++) {
        const s1 = sortedStops[i];
        const s2 = sortedStops[i + 1];
        if (argState >= s1 && argState < s2) {
          [start, end] = [argStops[s1], argStops[s2]];
          if (!argIsGradient) {
            return start;
          }
          val = this._calculateValueBetween(s1, s2, argState);
          break;
        }
      }
    }
    return this._getGradientValue(start, end, val);
  }

  /** *****************************************************************************
  * card::_calculateColor2()
  *
  * Summary.
  *
  * #TODO:
  * replace by TinyColor library? Is that possible/feasible??
  *
  */

  _calculateColor2(argState, argStops, argPart, argProperty, argIsGradient) {
    const sortedStops = Object.keys(argStops).map((n) => Number(n)).sort((a, b) => a - b);

    let start; let end; let
      val;
    const l = sortedStops.length;

    if (argState <= sortedStops[0]) {
      return argStops[sortedStops[0]];
    } else if (argState >= sortedStops[l - 1]) {
      return argStops[sortedStops[l - 1]];
    } else {
      for (let i = 0; i < l - 1; i++) {
        const s1 = sortedStops[i];
        const s2 = sortedStops[i + 1];
        if (argState >= s1 && argState < s2) {
          // console.log('calculateColor2 ', argStops[s1], argStops[s2]);
          [start, end] = [argStops[s1].styles[argPart][argProperty], argStops[s2].styles[argPart][argProperty]];
          if (!argIsGradient) {
            return start;
          }
          val = this._calculateValueBetween(s1, s2, argState);
          break;
        }
      }
    }
    return this._getGradientValue(start, end, val);
  }

  /** *****************************************************************************
  * card::_calculateValueBetween()
  *
  * Summary.
  * Clips the argValue value between argStart and argEnd, and returns the between value ;-)
  *
  * Returns NaN if argValue is undefined
  *
  * NOTE: Rename to valueToPercentage ??
  */

  _calculateValueBetween(argStart, argEnd, argValue) {
    return (Math.min(Math.max(argValue, argStart), argEnd) - argStart) / (argEnd - argStart);
  }

  /** *****************************************************************************
  * card::_getColorVariable()
  *
  * Summary.
  * Get value of CSS color variable, specified as var(--color-value)
  * These variables are defined in the Lovelace element so it appears...
  *
  */

  _getColorVariable(argColor) {
    const newColor = argColor.substr(4, argColor.length - 5);

    const returnColor = window.getComputedStyle(this).getPropertyValue(newColor);
    return returnColor;
  }

  /** *****************************************************************************
  * card::_getGradientValue()
  *
  * Summary.
  * Get gradient value of color as a result of a color_stop.
  * An RGBA value is calculated, so transparency is possible...
  *
  * The colors (colorA and colorB) can be specified as:
  * - a css variable, var(--color-value)
  * - a hex value, #fff or #ffffff
  * - an rgb() or rgba() value
  * - a hsl() or hsla() value
  * - a named css color value, such as white.
  *
  */

  _getGradientValue(argColorA, argColorB, argValue) {
    const resultColorA = this._colorToRGBA(argColorA);
    const resultColorB = this._colorToRGBA(argColorB);

    // We have a rgba() color array from cache or canvas.
    // Calculate color in between, and return #hex value as a result.
    //

    const v1 = 1 - argValue;
    const v2 = argValue;
    const rDec = Math.floor((resultColorA[0] * v1) + (resultColorB[0] * v2));
    const gDec = Math.floor((resultColorA[1] * v1) + (resultColorB[1] * v2));
    const bDec = Math.floor((resultColorA[2] * v1) + (resultColorB[2] * v2));
    const aDec = Math.floor((resultColorA[3] * v1) + (resultColorB[3] * v2));

    // And convert full RRGGBBAA value to #hex.
    const rHex = this._padZero(rDec.toString(16));
    const gHex = this._padZero(gDec.toString(16));
    const bHex = this._padZero(bDec.toString(16));
    const aHex = this._padZero(aDec.toString(16));

    return `#${rHex}${gHex}${bHex}${aHex}`;
  }

  _padZero(argValue) {
    if (argValue.length < 2) {
      argValue = `0${argValue}`;
    }
    return argValue.substr(0, 2);
  }

  _computeDomain(entityId) {
    return entityId.substr(0, entityId.indexOf('.'));
  }

  _computeEntity(entityId) {
    return entityId.substr(entityId.indexOf('.') + 1);
  }

  /** *****************************************************************************
  * card::_colorToRGBA()
  *
  * Summary.
  * Get RGBA color value of argColor.
  *
  * The argColor can be specified as:
  * - a css variable, var(--color-value)
  * - a hex value, #fff or #ffffff
  * - an rgb() or rgba() value
  * - a hsl() or hsla() value
  * - a named css color value, such as white.
  *
  */

  _colorToRGBA(argColor) {
    // return color if found in colorCache...
    const retColor = SwissArmyKnifeCard.colorCache[argColor];
    if (retColor) return retColor;

    let theColor = argColor;
    // Check for 'var' colors
    const a0 = argColor.substr(0, 3);
    if (a0.valueOf() === 'var') {
      theColor = this._getColorVariable(argColor);
    }

    // Get color from canvas. This always returns an rgba() value...
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = theColor;
    ctx.fillRect(0, 0, 1, 1);
    const outColor = [...ctx.getImageData(0, 0, 1, 1).data];

    SwissArmyKnifeCard.colorCache[argColor] = outColor;

    return outColor;
  }

  // 2022.01.25 #TODO
  // Reset interval to 5 minutes: is now short I think after connectedCallback().
  // Only if _hass exists / is set --> set to 5 minutes!
  //
  // BUG: If no history entity, the interval check keeps running. Initially set to 2000ms, and
  // keeps running with that interval. If history present, interval is larger ????????
  //
  // There is no check yet, if history is requested. That is the only reason to have this
  // interval active!
  updateOnInterval() {
    // Only update if hass is already set, this might be not the case the first few calls...
    // console.log("updateOnInterval -> check...");
    if (!this._hass) {
      if (this.dev.debug) console.log('UpdateOnInterval - NO hass, returning');
      return;
    }
    if (this.stateChanged && !this.entityHistory.updating) {
      // 2020.10.24
      // Leave true, as multiple entities can be fetched. fetch every 5 minutes...
      // this.stateChanged = false;
      this.updateData();
      // console.log("*RC* updateOnInterval -> updateData", this.entityHistory);
    }

    if (!this.entityHistory.needed) {
      // console.log("*RC* updateOnInterval -> stop timer", this.entityHistory, this.interval);
      if (this.interval) {
        window.clearInterval(this.interval);
        this.interval = 0;
      }
    } else {
      window.clearInterval(this.interval);
      this.interval = setInterval(
        () => this.updateOnInterval(),
        // 5 * 1000);
        this.entityHistory.update_interval * 1000,
      );
      // console.log("*RC* updateOnInterval -> start timer", this.entityHistory, this.interval);
    }
  }

  async fetchRecent(entityId, start, end, skipInitialState) {
    let url = 'history/period';
    if (start) url += `/${start.toISOString()}`;
    url += `?filter_entity_id=${entityId}`;
    if (end) url += `&end_time=${end.toISOString()}`;
    if (skipInitialState) url += '&skip_initial_state';
    url += '&minimal_response';

    // console.log('fetchRecent - call is', entityId, start, end, skipInitialState, url);
    return this._hass.callApi('GET', url);
  }

  async updateData({ config } = this) {
    this.entityHistory.updating = true;

    if (this.dev.debug) console.log('card::updateData - ENTRY', this.cardId);

    // We have a list of objects that might need some history update
    // Create list to fetch.
    const entityList = [];
    let j = 0;

    // #TODO
    // Lookup in this.tools for bars, or better tools that need history...
    // get that entity_index for that object
    // add to list...
    this.toolsets.map((toolset, k) => {
      toolset.tools.map((item, i) => {
        if (item.type == 'bar') {
          const end = new Date();
          const start = new Date();
          start.setHours(end.getHours() - item.tool.config.hours);
          const attr = this.config.entities[item.tool.config.entity_index].attribute ? this.config.entities[item.tool.config.entity_index].attribute : null;

          entityList[j] = ({
            tsidx: k, entityIndex: item.tool.config.entity_index, entityId: this.entities[item.tool.config.entity_index].entity_id, attrId: attr, start, end, type: 'bar', idx: i,
          });
          j++;
        }
      });
    });

    if (this.dev.debug) console.log('card::updateData - LENGTH', this.cardId, entityList.length, entityList);

    // #TODO
    // Quick hack to block updates if entrylist is empty
    this.stateChanged = false;

    if (this.dev.debug) console.log('card::updateData, entityList from tools', entityList);

    try {
      //      const promise = this.config.layout.vbars.map((item, i) => this.updateEntity(item, entity, i, start, end));
      const promise = entityList.map((item, i) => this.updateEntity(item, i, item.start, item.end));
      await Promise.all(promise);
    } finally {
      this.entityHistory.updating = false;
    }
  }

  async updateEntity(entity, index, initStart, end) {
    let stateHistory = [];
    const start = initStart;
    const skipInitialState = false;

    // Get history for this entity and/or attribute.
    let newStateHistory = await this.fetchRecent(entity.entityId, start, end, skipInitialState);

    // Now we have some history, check if it has valid data and filter out either the entity state or
    // the entity attribute. Ain't that nice!

    let theState;

    if (newStateHistory[0] && newStateHistory[0].length > 0) {
      if (entity.attrId) {
        theState = this.entities[entity.entityIndex].attributes[this.config.entities[entity.entityIndex].attribute];
        entity.state = theState;
      }
      newStateHistory = newStateHistory[0].filter((item) => (entity.attrId ? !Number.isNaN(parseFloat(item.attributes[entity.attrId])) : !Number.isNaN(parseFloat(item.state))));

      newStateHistory = newStateHistory.map((item) => ({
        last_changed: item.last_changed,
        state: entity.attrId ? Number(item.attributes[entity.attrId]) : Number(item.state),
      }));
    }

    stateHistory = [...stateHistory, ...newStateHistory];

    this.uppdate(entity, stateHistory);
  }

  uppdate(entity, hist) {
    if (!hist) return;

    // #LGTM: Unused variable getMin.
    // Keep this one for later use!!!!!!!!!!!!!!!!!
    // const getMin = (arr, val) => arr.reduce((min, p) => (
    // Number(p[val]) < Number(min[val]) ? p : min
    // ), arr[0]);

    const getAvg = (arr, val) => arr.reduce((sum, p) => (
      sum + Number(p[val])
    ), 0) / arr.length;

    const now = new Date().getTime();

    let hours = 24;
    let barhours = 2;

    if (entity.type == 'bar') {
      if (this.dev.debug) console.log('entity.type == bar', entity);

      hours = this.toolsets[entity.tsidx].tools[entity.idx].tool.config.hours;
      barhours = this.toolsets[entity.tsidx].tools[entity.idx].tool.config.barhours;
    }

    const reduce = (res, item) => {
      const age = now - new Date(item.last_changed).getTime();
      const interval = (age / (1000 * 3600) / barhours) - (hours / barhours);
      const key = Math.floor(Math.abs(interval));
      if (!res[key]) res[key] = [];
      res[key].push(item);
      return res;
    };
    const coords = hist.reduce((res, item) => reduce(res, item), []);
    coords.length = Math.ceil(hours / barhours);

    // If no intervals found, return...
    if (Object.keys(coords).length == 0) {
      return;
    }

    // That STUPID STUPID Math.min/max can't handle empty arrays which are put into it below
    // so add some data to the array, and everything works!!!!!!

    // check if first interval contains data, if not find first in interval and use first entry as value...

    const firstInterval = Object.keys(coords)[0];
    if (firstInterval != '0') {
      // first index doesn't contain data.
      coords[0] = [];

      coords[0].push(coords[firstInterval][0]);
    }

    for (let i = 0; i < (hours / barhours); i++) {
      if (!coords[i]) {
        coords[i] = [];
        coords[i].push(coords[i - 1][coords[i - 1].length - 1]);
      }
    }
    this.coords = coords;
    let theData = [];
    theData = [];
    theData = coords.map((item) => getAvg(item, 'state'));

    // now push data into object...
    if (entity.type == 'bar') {
      this.toolsets[entity.tsidx].tools[entity.idx].tool.series = [...theData];
    }

    // Request a rerender of the card after receiving new data
    this.requestUpdate();
  }

  /** *****************************************************************************
  * card::getCardSize()
  *
  * Summary.
  * Return a fixed value of 4 as the height.
  *
  */

  getCardSize() {
    return (4);
  }
}

/**
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

// Define the custom Swiss Army Knife card, so Lovelace / Lit can find the custom element!
customElements.define('swiss-army-knife-card', SwissArmyKnifeCard);
//# sourceMappingURL=swiss-army-knife-card-bundle.js.map
