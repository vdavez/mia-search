(function (factory) {
    typeof define === 'function' && define.amd ? define(factory) :
    factory();
})((function () { 'use strict';

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    var __assign = function() {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };

    function __values(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }

    function __read(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    }

    /** @ignore */
    var ENTRIES = 'ENTRIES';
    /** @ignore */
    var KEYS = 'KEYS';
    /** @ignore */
    var VALUES = 'VALUES';
    /** @ignore */
    var LEAF = '';
    /**
     * @private
     */
    var TreeIterator = /** @class */ (function () {
        function TreeIterator(set, type) {
            var node = set._tree;
            var keys = Array.from(node.keys());
            this.set = set;
            this._type = type;
            this._path = keys.length > 0 ? [{ node: node, keys: keys }] : [];
        }
        TreeIterator.prototype.next = function () {
            var value = this.dive();
            this.backtrack();
            return value;
        };
        TreeIterator.prototype.dive = function () {
            if (this._path.length === 0) {
                return { done: true, value: undefined };
            }
            var _a = last$1(this._path), node = _a.node, keys = _a.keys;
            if (last$1(keys) === LEAF) {
                return { done: false, value: this.result() };
            }
            var child = node.get(last$1(keys));
            this._path.push({ node: child, keys: Array.from(child.keys()) });
            return this.dive();
        };
        TreeIterator.prototype.backtrack = function () {
            if (this._path.length === 0) {
                return;
            }
            var keys = last$1(this._path).keys;
            keys.pop();
            if (keys.length > 0) {
                return;
            }
            this._path.pop();
            this.backtrack();
        };
        TreeIterator.prototype.key = function () {
            return this.set._prefix + this._path
                .map(function (_a) {
                var keys = _a.keys;
                return last$1(keys);
            })
                .filter(function (key) { return key !== LEAF; })
                .join('');
        };
        TreeIterator.prototype.value = function () {
            return last$1(this._path).node.get(LEAF);
        };
        TreeIterator.prototype.result = function () {
            switch (this._type) {
                case VALUES: return this.value();
                case KEYS: return this.key();
                default: return [this.key(), this.value()];
            }
        };
        TreeIterator.prototype[Symbol.iterator] = function () {
            return this;
        };
        return TreeIterator;
    }());
    var last$1 = function (array) {
        return array[array.length - 1];
    };

    /**
     * @ignore
     */
    var fuzzySearch = function (node, query, maxDistance) {
        var results = new Map();
        if (query === undefined)
            return results;
        // Number of columns in the Levenshtein matrix.
        var n = query.length + 1;
        // Matching terms can never be longer than N + maxDistance.
        var m = n + maxDistance;
        // Fill first matrix row and column with numbers: 0 1 2 3 ...
        var matrix = new Uint8Array(m * n).fill(maxDistance + 1);
        for (var j = 0; j < n; ++j)
            matrix[j] = j;
        for (var i = 1; i < m; ++i)
            matrix[i * n] = i;
        recurse(node, query, maxDistance, results, matrix, 1, n, '');
        return results;
    };
    // Modified version of http://stevehanov.ca/blog/?id=114
    // This builds a Levenshtein matrix for a given query and continuously updates
    // it for nodes in the radix tree that fall within the given maximum edit
    // distance. Keeping the same matrix around is beneficial especially for larger
    // edit distances.
    //
    //           k   a   t   e   <-- query
    //       0   1   2   3   4
    //   c   1   1   2   3   4
    //   a   2   2   1   2   3
    //   t   3   3   2   1  [2]  <-- edit distance
    //   ^
    //   ^ term in radix tree, rows are added and removed as needed
    var recurse = function (node, query, maxDistance, results, matrix, m, n, prefix) {
        var e_1, _a;
        var offset = m * n;
        try {
            key: for (var _b = __values(node.keys()), _c = _b.next(); !_c.done; _c = _b.next()) {
                var key = _c.value;
                if (key === LEAF) {
                    // We've reached a leaf node. Check if the edit distance acceptable and
                    // store the result if it is.
                    var distance = matrix[offset - 1];
                    if (distance <= maxDistance) {
                        results.set(prefix, [node.get(key), distance]);
                    }
                }
                else {
                    // Iterate over all characters in the key. Update the Levenshtein matrix
                    // and check if the minimum distance in the last row is still within the
                    // maximum edit distance. If it is, we can recurse over all child nodes.
                    var i = m;
                    for (var pos = 0; pos < key.length; ++pos, ++i) {
                        var char = key[pos];
                        var thisRowOffset = n * i;
                        var prevRowOffset = thisRowOffset - n;
                        // Set the first column based on the previous row, and initialize the
                        // minimum distance in the current row.
                        var minDistance = matrix[thisRowOffset];
                        var jmin = Math.max(0, i - maxDistance - 1);
                        var jmax = Math.min(n - 1, i + maxDistance);
                        // Iterate over remaining columns (characters in the query).
                        for (var j = jmin; j < jmax; ++j) {
                            var different = char !== query[j];
                            // It might make sense to only read the matrix positions used for
                            // deletion/insertion if the characters are different. But we want to
                            // avoid conditional reads for performance reasons.
                            var rpl = matrix[prevRowOffset + j] + +different;
                            var del = matrix[prevRowOffset + j + 1] + 1;
                            var ins = matrix[thisRowOffset + j] + 1;
                            var dist = matrix[thisRowOffset + j + 1] = Math.min(rpl, del, ins);
                            if (dist < minDistance)
                                minDistance = dist;
                        }
                        // Because distance will never decrease, we can stop. There will be no
                        // matching child nodes.
                        if (minDistance > maxDistance) {
                            continue key;
                        }
                    }
                    recurse(node.get(key), query, maxDistance, results, matrix, i, n, prefix + key);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
    };

    /**
     * A class implementing the same interface as a standard JavaScript
     * [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)
     * with string keys, but adding support for efficiently searching entries with
     * prefix or fuzzy search. This class is used internally by [[MiniSearch]] as
     * the inverted index data structure. The implementation is a radix tree
     * (compressed prefix tree).
     *
     * Since this class can be of general utility beyond _MiniSearch_, it is
     * exported by the `minisearch` package and can be imported (or required) as
     * `minisearch/SearchableMap`.
     *
     * @typeParam T  The type of the values stored in the map.
     */
    var SearchableMap = /** @class */ (function () {
        /**
         * The constructor is normally called without arguments, creating an empty
         * map. In order to create a [[SearchableMap]] from an iterable or from an
         * object, check [[SearchableMap.from]] and [[SearchableMap.fromObject]].
         *
         * The constructor arguments are for internal use, when creating derived
         * mutable views of a map at a prefix.
         */
        function SearchableMap(tree, prefix) {
            if (tree === void 0) { tree = new Map(); }
            if (prefix === void 0) { prefix = ''; }
            this._size = undefined;
            this._tree = tree;
            this._prefix = prefix;
        }
        /**
         * Creates and returns a mutable view of this [[SearchableMap]], containing only
         * entries that share the given prefix.
         *
         * ### Usage:
         *
         * ```javascript
         * let map = new SearchableMap()
         * map.set("unicorn", 1)
         * map.set("universe", 2)
         * map.set("university", 3)
         * map.set("unique", 4)
         * map.set("hello", 5)
         *
         * let uni = map.atPrefix("uni")
         * uni.get("unique") // => 4
         * uni.get("unicorn") // => 1
         * uni.get("hello") // => undefined
         *
         * let univer = map.atPrefix("univer")
         * univer.get("unique") // => undefined
         * univer.get("universe") // => 2
         * univer.get("university") // => 3
         * ```
         *
         * @param prefix  The prefix
         * @return A [[SearchableMap]] representing a mutable view of the original Map at the given prefix
         */
        SearchableMap.prototype.atPrefix = function (prefix) {
            var e_1, _a;
            if (!prefix.startsWith(this._prefix)) {
                throw new Error('Mismatched prefix');
            }
            var _b = __read(trackDown(this._tree, prefix.slice(this._prefix.length)), 2), node = _b[0], path = _b[1];
            if (node === undefined) {
                var _c = __read(last(path), 2), parentNode = _c[0], key = _c[1];
                try {
                    for (var _d = __values(parentNode.keys()), _e = _d.next(); !_e.done; _e = _d.next()) {
                        var k = _e.value;
                        if (k !== LEAF && k.startsWith(key)) {
                            var node_1 = new Map();
                            node_1.set(k.slice(key.length), parentNode.get(k));
                            return new SearchableMap(node_1, prefix);
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            }
            return new SearchableMap(node, prefix);
        };
        /**
         * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/clear
         */
        SearchableMap.prototype.clear = function () {
            this._size = undefined;
            this._tree.clear();
        };
        /**
         * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/delete
         * @param key  Key to delete
         */
        SearchableMap.prototype.delete = function (key) {
            this._size = undefined;
            return remove(this._tree, key);
        };
        /**
         * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/entries
         * @return An iterator iterating through `[key, value]` entries.
         */
        SearchableMap.prototype.entries = function () {
            return new TreeIterator(this, ENTRIES);
        };
        /**
         * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/forEach
         * @param fn  Iteration function
         */
        SearchableMap.prototype.forEach = function (fn) {
            var e_2, _a;
            try {
                for (var _b = __values(this), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var _d = __read(_c.value, 2), key = _d[0], value = _d[1];
                    fn(key, value, this);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_2) throw e_2.error; }
            }
        };
        /**
         * Returns a Map of all the entries that have a key within the given edit
         * distance from the search key. The keys of the returned Map are the matching
         * keys, while the values are two-element arrays where the first element is
         * the value associated to the key, and the second is the edit distance of the
         * key to the search key.
         *
         * ### Usage:
         *
         * ```javascript
         * let map = new SearchableMap()
         * map.set('hello', 'world')
         * map.set('hell', 'yeah')
         * map.set('ciao', 'mondo')
         *
         * // Get all entries that match the key 'hallo' with a maximum edit distance of 2
         * map.fuzzyGet('hallo', 2)
         * // => Map(2) { 'hello' => ['world', 1], 'hell' => ['yeah', 2] }
         *
         * // In the example, the "hello" key has value "world" and edit distance of 1
         * // (change "e" to "a"), the key "hell" has value "yeah" and edit distance of 2
         * // (change "e" to "a", delete "o")
         * ```
         *
         * @param key  The search key
         * @param maxEditDistance  The maximum edit distance (Levenshtein)
         * @return A Map of the matching keys to their value and edit distance
         */
        SearchableMap.prototype.fuzzyGet = function (key, maxEditDistance) {
            return fuzzySearch(this._tree, key, maxEditDistance);
        };
        /**
         * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/get
         * @param key  Key to get
         * @return Value associated to the key, or `undefined` if the key is not
         * found.
         */
        SearchableMap.prototype.get = function (key) {
            var node = lookup(this._tree, key);
            return node !== undefined ? node.get(LEAF) : undefined;
        };
        /**
         * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/has
         * @param key  Key
         * @return True if the key is in the map, false otherwise
         */
        SearchableMap.prototype.has = function (key) {
            var node = lookup(this._tree, key);
            return node !== undefined && node.has(LEAF);
        };
        /**
         * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/keys
         * @return An `Iterable` iterating through keys
         */
        SearchableMap.prototype.keys = function () {
            return new TreeIterator(this, KEYS);
        };
        /**
         * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/set
         * @param key  Key to set
         * @param value  Value to associate to the key
         * @return The [[SearchableMap]] itself, to allow chaining
         */
        SearchableMap.prototype.set = function (key, value) {
            if (typeof key !== 'string') {
                throw new Error('key must be a string');
            }
            this._size = undefined;
            var node = createPath(this._tree, key);
            node.set(LEAF, value);
            return this;
        };
        Object.defineProperty(SearchableMap.prototype, "size", {
            /**
             * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/size
             */
            get: function () {
                if (this._size) {
                    return this._size;
                }
                /** @ignore */
                this._size = 0;
                var iter = this.entries();
                while (!iter.next().done)
                    this._size += 1;
                return this._size;
            },
            enumerable: false,
            configurable: true
        });
        /**
         * Updates the value at the given key using the provided function. The function
         * is called with the current value at the key, and its return value is used as
         * the new value to be set.
         *
         * ### Example:
         *
         * ```javascript
         * // Increment the current value by one
         * searchableMap.update('somekey', (currentValue) => currentValue == null ? 0 : currentValue + 1)
         * ```
         *
         * If the value at the given key is or will be an object, it might not require
         * re-assignment. In that case it is better to use `fetch()`, because it is
         * faster.
         *
         * @param key  The key to update
         * @param fn  The function used to compute the new value from the current one
         * @return The [[SearchableMap]] itself, to allow chaining
         */
        SearchableMap.prototype.update = function (key, fn) {
            if (typeof key !== 'string') {
                throw new Error('key must be a string');
            }
            this._size = undefined;
            var node = createPath(this._tree, key);
            node.set(LEAF, fn(node.get(LEAF)));
            return this;
        };
        /**
         * Fetches the value of the given key. If the value does not exist, calls the
         * given function to create a new value, which is inserted at the given key
         * and subsequently returned.
         *
         * ### Example:
         *
         * ```javascript
         * const map = searchableMap.fetch('somekey', () => new Map())
         * map.set('foo', 'bar')
         * ```
         *
         * @param key  The key to update
         * @param defaultValue  A function that creates a new value if the key does not exist
         * @return The existing or new value at the given key
         */
        SearchableMap.prototype.fetch = function (key, initial) {
            if (typeof key !== 'string') {
                throw new Error('key must be a string');
            }
            this._size = undefined;
            var node = createPath(this._tree, key);
            var value = node.get(LEAF);
            if (value === undefined) {
                node.set(LEAF, value = initial());
            }
            return value;
        };
        /**
         * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/values
         * @return An `Iterable` iterating through values.
         */
        SearchableMap.prototype.values = function () {
            return new TreeIterator(this, VALUES);
        };
        /**
         * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/@@iterator
         */
        SearchableMap.prototype[Symbol.iterator] = function () {
            return this.entries();
        };
        /**
         * Creates a [[SearchableMap]] from an `Iterable` of entries
         *
         * @param entries  Entries to be inserted in the [[SearchableMap]]
         * @return A new [[SearchableMap]] with the given entries
         */
        SearchableMap.from = function (entries) {
            var e_3, _a;
            var tree = new SearchableMap();
            try {
                for (var entries_1 = __values(entries), entries_1_1 = entries_1.next(); !entries_1_1.done; entries_1_1 = entries_1.next()) {
                    var _b = __read(entries_1_1.value, 2), key = _b[0], value = _b[1];
                    tree.set(key, value);
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (entries_1_1 && !entries_1_1.done && (_a = entries_1.return)) _a.call(entries_1);
                }
                finally { if (e_3) throw e_3.error; }
            }
            return tree;
        };
        /**
         * Creates a [[SearchableMap]] from the iterable properties of a JavaScript object
         *
         * @param object  Object of entries for the [[SearchableMap]]
         * @return A new [[SearchableMap]] with the given entries
         */
        SearchableMap.fromObject = function (object) {
            return SearchableMap.from(Object.entries(object));
        };
        return SearchableMap;
    }());
    var trackDown = function (tree, key, path) {
        var e_4, _a;
        if (path === void 0) { path = []; }
        if (key.length === 0 || tree == null) {
            return [tree, path];
        }
        try {
            for (var _b = __values(tree.keys()), _c = _b.next(); !_c.done; _c = _b.next()) {
                var k = _c.value;
                if (k !== LEAF && key.startsWith(k)) {
                    path.push([tree, k]); // performance: update in place
                    return trackDown(tree.get(k), key.slice(k.length), path);
                }
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_4) throw e_4.error; }
        }
        path.push([tree, key]); // performance: update in place
        return trackDown(undefined, '', path);
    };
    var lookup = function (tree, key) {
        var e_5, _a;
        if (key.length === 0 || tree == null) {
            return tree;
        }
        try {
            for (var _b = __values(tree.keys()), _c = _b.next(); !_c.done; _c = _b.next()) {
                var k = _c.value;
                if (k !== LEAF && key.startsWith(k)) {
                    return lookup(tree.get(k), key.slice(k.length));
                }
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_5) throw e_5.error; }
        }
    };
    // Create a path in the radix tree for the given key, and returns the deepest
    // node. This function is in the hot path for indexing. It avoids unnecessary
    // string operations and recursion for performance.
    var createPath = function (node, key) {
        var e_6, _a;
        var keyLength = key.length;
        outer: for (var pos = 0; node && pos < keyLength;) {
            try {
                for (var _b = (e_6 = void 0, __values(node.keys())), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var k = _c.value;
                    // Check whether this key is a candidate: the first characters must match.
                    if (k !== LEAF && key[pos] === k[0]) {
                        var len = Math.min(keyLength - pos, k.length);
                        // Advance offset to the point where key and k no longer match.
                        var offset = 1;
                        while (offset < len && key[pos + offset] === k[offset])
                            ++offset;
                        var child_1 = node.get(k);
                        if (offset === k.length) {
                            // The existing key is shorter than the key we need to create.
                            node = child_1;
                        }
                        else {
                            // Partial match: we need to insert an intermediate node to contain
                            // both the existing subtree and the new node.
                            var intermediate = new Map();
                            intermediate.set(k.slice(offset), child_1);
                            node.set(key.slice(pos, pos + offset), intermediate);
                            node.delete(k);
                            node = intermediate;
                        }
                        pos += offset;
                        continue outer;
                    }
                }
            }
            catch (e_6_1) { e_6 = { error: e_6_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_6) throw e_6.error; }
            }
            // Create a final child node to contain the final suffix of the key.
            var child = new Map();
            node.set(key.slice(pos), child);
            return child;
        }
        return node;
    };
    var remove = function (tree, key) {
        var _a = __read(trackDown(tree, key), 2), node = _a[0], path = _a[1];
        if (node === undefined) {
            return;
        }
        node.delete(LEAF);
        if (node.size === 0) {
            cleanup(path);
        }
        else if (node.size === 1) {
            var _b = __read(node.entries().next().value, 2), key_1 = _b[0], value = _b[1];
            merge(path, key_1, value);
        }
    };
    var cleanup = function (path) {
        if (path.length === 0) {
            return;
        }
        var _a = __read(last(path), 2), node = _a[0], key = _a[1];
        node.delete(key);
        if (node.size === 0) {
            cleanup(path.slice(0, -1));
        }
        else if (node.size === 1) {
            var _b = __read(node.entries().next().value, 2), key_2 = _b[0], value = _b[1];
            if (key_2 !== LEAF) {
                merge(path.slice(0, -1), key_2, value);
            }
        }
    };
    var merge = function (path, key, value) {
        if (path.length === 0) {
            return;
        }
        var _a = __read(last(path), 2), node = _a[0], nodeKey = _a[1];
        node.set(nodeKey + key, value);
        node.delete(nodeKey);
    };
    var last = function (array) {
        return array[array.length - 1];
    };

    var _a;
    var OR = 'or';
    var AND = 'and';
    var AND_NOT = 'and_not';
    /**
     * [[MiniSearch]] is the main entrypoint class, implementing a full-text search
     * engine in memory.
     *
     * @typeParam T  The type of the documents being indexed.
     *
     * ### Basic example:
     *
     * ```javascript
     * const documents = [
     *   {
     *     id: 1,
     *     title: 'Moby Dick',
     *     text: 'Call me Ishmael. Some years ago...',
     *     category: 'fiction'
     *   },
     *   {
     *     id: 2,
     *     title: 'Zen and the Art of Motorcycle Maintenance',
     *     text: 'I can see by my watch...',
     *     category: 'fiction'
     *   },
     *   {
     *     id: 3,
     *     title: 'Neuromancer',
     *     text: 'The sky above the port was...',
     *     category: 'fiction'
     *   },
     *   {
     *     id: 4,
     *     title: 'Zen and the Art of Archery',
     *     text: 'At first sight it must seem...',
     *     category: 'non-fiction'
     *   },
     *   // ...and more
     * ]
     *
     * // Create a search engine that indexes the 'title' and 'text' fields for
     * // full-text search. Search results will include 'title' and 'category' (plus the
     * // id field, that is always stored and returned)
     * const miniSearch = new MiniSearch({
     *   fields: ['title', 'text'],
     *   storeFields: ['title', 'category']
     * })
     *
     * // Add documents to the index
     * miniSearch.addAll(documents)
     *
     * // Search for documents:
     * let results = miniSearch.search('zen art motorcycle')
     * // => [
     * //   { id: 2, title: 'Zen and the Art of Motorcycle Maintenance', category: 'fiction', score: 2.77258 },
     * //   { id: 4, title: 'Zen and the Art of Archery', category: 'non-fiction', score: 1.38629 }
     * // ]
     * ```
     */
    var MiniSearch = /** @class */ (function () {
        /**
         * @param options  Configuration options
         *
         * ### Examples:
         *
         * ```javascript
         * // Create a search engine that indexes the 'title' and 'text' fields of your
         * // documents:
         * const miniSearch = new MiniSearch({ fields: ['title', 'text'] })
         * ```
         *
         * ### ID Field:
         *
         * ```javascript
         * // Your documents are assumed to include a unique 'id' field, but if you want
         * // to use a different field for document identification, you can set the
         * // 'idField' option:
         * const miniSearch = new MiniSearch({ idField: 'key', fields: ['title', 'text'] })
         * ```
         *
         * ### Options and defaults:
         *
         * ```javascript
         * // The full set of options (here with their default value) is:
         * const miniSearch = new MiniSearch({
         *   // idField: field that uniquely identifies a document
         *   idField: 'id',
         *
         *   // extractField: function used to get the value of a field in a document.
         *   // By default, it assumes the document is a flat object with field names as
         *   // property keys and field values as string property values, but custom logic
         *   // can be implemented by setting this option to a custom extractor function.
         *   extractField: (document, fieldName) => document[fieldName],
         *
         *   // tokenize: function used to split fields into individual terms. By
         *   // default, it is also used to tokenize search queries, unless a specific
         *   // `tokenize` search option is supplied. When tokenizing an indexed field,
         *   // the field name is passed as the second argument.
         *   tokenize: (string, _fieldName) => string.split(SPACE_OR_PUNCTUATION),
         *
         *   // processTerm: function used to process each tokenized term before
         *   // indexing. It can be used for stemming and normalization. Return a falsy
         *   // value in order to discard a term. By default, it is also used to process
         *   // search queries, unless a specific `processTerm` option is supplied as a
         *   // search option. When processing a term from a indexed field, the field
         *   // name is passed as the second argument.
         *   processTerm: (term, _fieldName) => term.toLowerCase(),
         *
         *   // searchOptions: default search options, see the `search` method for
         *   // details
         *   searchOptions: undefined,
         *
         *   // fields: document fields to be indexed. Mandatory, but not set by default
         *   fields: undefined
         *
         *   // storeFields: document fields to be stored and returned as part of the
         *   // search results.
         *   storeFields: []
         * })
         * ```
         */
        function MiniSearch(options) {
            if ((options === null || options === void 0 ? void 0 : options.fields) == null) {
                throw new Error('MiniSearch: option "fields" must be provided');
            }
            this._options = __assign(__assign(__assign({}, defaultOptions), options), { searchOptions: __assign(__assign({}, defaultSearchOptions), (options.searchOptions || {})) });
            this._index = new SearchableMap();
            this._documentCount = 0;
            this._documentIds = new Map();
            // Fields are defined during initialization, don't change, are few in
            // number, rarely need iterating over, and have string keys. Therefore in
            // this case an object is a better candidate than a Map to store the mapping
            // from field key to ID.
            this._fieldIds = {};
            this._fieldLength = new Map();
            this._avgFieldLength = [];
            this._nextId = 0;
            this._storedFields = new Map();
            this.addFields(this._options.fields);
        }
        /**
         * Adds a document to the index
         *
         * @param document  The document to be indexed
         */
        MiniSearch.prototype.add = function (document) {
            var e_1, _a, e_2, _b;
            var _c = this._options, extractField = _c.extractField, tokenize = _c.tokenize, processTerm = _c.processTerm, fields = _c.fields, idField = _c.idField;
            var id = extractField(document, idField);
            if (id == null) {
                throw new Error("MiniSearch: document does not have ID field \"".concat(idField, "\""));
            }
            var shortDocumentId = this.addDocumentId(id);
            this.saveStoredFields(shortDocumentId, document);
            try {
                for (var fields_1 = __values(fields), fields_1_1 = fields_1.next(); !fields_1_1.done; fields_1_1 = fields_1.next()) {
                    var field = fields_1_1.value;
                    var fieldValue = extractField(document, field);
                    if (fieldValue == null)
                        continue;
                    var tokens = tokenize(fieldValue.toString(), field);
                    var fieldId = this._fieldIds[field];
                    var uniqueTerms = new Set(tokens).size;
                    this.addFieldLength(shortDocumentId, fieldId, this._documentCount - 1, uniqueTerms);
                    try {
                        for (var tokens_1 = (e_2 = void 0, __values(tokens)), tokens_1_1 = tokens_1.next(); !tokens_1_1.done; tokens_1_1 = tokens_1.next()) {
                            var term = tokens_1_1.value;
                            var processedTerm = processTerm(term, field);
                            if (processedTerm) {
                                this.addTerm(fieldId, shortDocumentId, processedTerm);
                            }
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (tokens_1_1 && !tokens_1_1.done && (_b = tokens_1.return)) _b.call(tokens_1);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (fields_1_1 && !fields_1_1.done && (_a = fields_1.return)) _a.call(fields_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        };
        /**
         * Adds all the given documents to the index
         *
         * @param documents  An array of documents to be indexed
         */
        MiniSearch.prototype.addAll = function (documents) {
            var e_3, _a;
            try {
                for (var documents_1 = __values(documents), documents_1_1 = documents_1.next(); !documents_1_1.done; documents_1_1 = documents_1.next()) {
                    var document_1 = documents_1_1.value;
                    this.add(document_1);
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (documents_1_1 && !documents_1_1.done && (_a = documents_1.return)) _a.call(documents_1);
                }
                finally { if (e_3) throw e_3.error; }
            }
        };
        /**
         * Adds all the given documents to the index asynchronously.
         *
         * Returns a promise that resolves (to `undefined`) when the indexing is done.
         * This method is useful when index many documents, to avoid blocking the main
         * thread. The indexing is performed asynchronously and in chunks.
         *
         * @param documents  An array of documents to be indexed
         * @param options  Configuration options
         * @return A promise resolving to `undefined` when the indexing is done
         */
        MiniSearch.prototype.addAllAsync = function (documents, options) {
            var _this = this;
            if (options === void 0) { options = {}; }
            var _a = options.chunkSize, chunkSize = _a === void 0 ? 10 : _a;
            var acc = { chunk: [], promise: Promise.resolve() };
            var _b = documents.reduce(function (_a, document, i) {
                var chunk = _a.chunk, promise = _a.promise;
                chunk.push(document);
                if ((i + 1) % chunkSize === 0) {
                    return {
                        chunk: [],
                        promise: promise
                            .then(function () { return new Promise(function (resolve) { return setTimeout(resolve, 0); }); })
                            .then(function () { return _this.addAll(chunk); })
                    };
                }
                else {
                    return { chunk: chunk, promise: promise };
                }
            }, acc), chunk = _b.chunk, promise = _b.promise;
            return promise.then(function () { return _this.addAll(chunk); });
        };
        /**
         * Removes the given document from the index.
         *
         * The document to delete must NOT have changed between indexing and deletion,
         * otherwise the index will be corrupted. Therefore, when reindexing a document
         * after a change, the correct order of operations is:
         *
         *   1. remove old version
         *   2. apply changes
         *   3. index new version
         *
         * @param document  The document to be removed
         */
        MiniSearch.prototype.remove = function (document) {
            var e_4, _a, e_5, _b, e_6, _c;
            var _d = this._options, tokenize = _d.tokenize, processTerm = _d.processTerm, extractField = _d.extractField, fields = _d.fields, idField = _d.idField;
            var id = extractField(document, idField);
            if (id == null) {
                throw new Error("MiniSearch: document does not have ID field \"".concat(idField, "\""));
            }
            try {
                for (var _e = __values(this._documentIds), _f = _e.next(); !_f.done; _f = _e.next()) {
                    var _g = __read(_f.value, 2), shortId = _g[0], longId = _g[1];
                    if (id === longId) {
                        try {
                            for (var fields_2 = (e_5 = void 0, __values(fields)), fields_2_1 = fields_2.next(); !fields_2_1.done; fields_2_1 = fields_2.next()) {
                                var field = fields_2_1.value;
                                var fieldValue = extractField(document, field);
                                if (fieldValue == null)
                                    continue;
                                var tokens = tokenize(fieldValue.toString(), field);
                                var fieldId = this._fieldIds[field];
                                var uniqueTerms = new Set(tokens).size;
                                this.removeFieldLength(shortId, fieldId, this._documentCount, uniqueTerms);
                                try {
                                    for (var tokens_2 = (e_6 = void 0, __values(tokens)), tokens_2_1 = tokens_2.next(); !tokens_2_1.done; tokens_2_1 = tokens_2.next()) {
                                        var term = tokens_2_1.value;
                                        var processedTerm = processTerm(term, field);
                                        if (processedTerm) {
                                            this.removeTerm(fieldId, shortId, processedTerm);
                                        }
                                    }
                                }
                                catch (e_6_1) { e_6 = { error: e_6_1 }; }
                                finally {
                                    try {
                                        if (tokens_2_1 && !tokens_2_1.done && (_c = tokens_2.return)) _c.call(tokens_2);
                                    }
                                    finally { if (e_6) throw e_6.error; }
                                }
                            }
                        }
                        catch (e_5_1) { e_5 = { error: e_5_1 }; }
                        finally {
                            try {
                                if (fields_2_1 && !fields_2_1.done && (_b = fields_2.return)) _b.call(fields_2);
                            }
                            finally { if (e_5) throw e_5.error; }
                        }
                        this._storedFields.delete(shortId);
                        this._documentIds.delete(shortId);
                        this._fieldLength.delete(shortId);
                        this._documentCount -= 1;
                        return;
                    }
                }
            }
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (_f && !_f.done && (_a = _e.return)) _a.call(_e);
                }
                finally { if (e_4) throw e_4.error; }
            }
            throw new Error("MiniSearch: cannot remove document with ID ".concat(id, ": it is not in the index"));
        };
        /**
         * Removes all the given documents from the index. If called with no arguments,
         * it removes _all_ documents from the index.
         *
         * @param documents  The documents to be removed. If this argument is omitted,
         * all documents are removed. Note that, for removing all documents, it is
         * more efficient to call this method with no arguments than to pass all
         * documents.
         */
        MiniSearch.prototype.removeAll = function (documents) {
            var e_7, _a;
            if (documents) {
                try {
                    for (var documents_2 = __values(documents), documents_2_1 = documents_2.next(); !documents_2_1.done; documents_2_1 = documents_2.next()) {
                        var document_2 = documents_2_1.value;
                        this.remove(document_2);
                    }
                }
                catch (e_7_1) { e_7 = { error: e_7_1 }; }
                finally {
                    try {
                        if (documents_2_1 && !documents_2_1.done && (_a = documents_2.return)) _a.call(documents_2);
                    }
                    finally { if (e_7) throw e_7.error; }
                }
            }
            else if (arguments.length > 0) {
                throw new Error('Expected documents to be present. Omit the argument to remove all documents.');
            }
            else {
                this._index = new SearchableMap();
                this._documentCount = 0;
                this._documentIds = new Map();
                this._fieldLength = new Map();
                this._avgFieldLength = [];
                this._storedFields = new Map();
                this._nextId = 0;
            }
        };
        /**
         * Search for documents matching the given search query.
         *
         * The result is a list of scored document IDs matching the query, sorted by
         * descending score, and each including data about which terms were matched and
         * in which fields.
         *
         * ### Basic usage:
         *
         * ```javascript
         * // Search for "zen art motorcycle" with default options: terms have to match
         * // exactly, and individual terms are joined with OR
         * miniSearch.search('zen art motorcycle')
         * // => [ { id: 2, score: 2.77258, match: { ... } }, { id: 4, score: 1.38629, match: { ... } } ]
         * ```
         *
         * ### Restrict search to specific fields:
         *
         * ```javascript
         * // Search only in the 'title' field
         * miniSearch.search('zen', { fields: ['title'] })
         * ```
         *
         * ### Field boosting:
         *
         * ```javascript
         * // Boost a field
         * miniSearch.search('zen', { boost: { title: 2 } })
         * ```
         *
         * ### Prefix search:
         *
         * ```javascript
         * // Search for "moto" with prefix search (it will match documents
         * // containing terms that start with "moto" or "neuro")
         * miniSearch.search('moto neuro', { prefix: true })
         * ```
         *
         * ### Fuzzy search:
         *
         * ```javascript
         * // Search for "ismael" with fuzzy search (it will match documents containing
         * // terms similar to "ismael", with a maximum edit distance of 0.2 term.length
         * // (rounded to nearest integer)
         * miniSearch.search('ismael', { fuzzy: 0.2 })
         * ```
         *
         * ### Combining strategies:
         *
         * ```javascript
         * // Mix of exact match, prefix search, and fuzzy search
         * miniSearch.search('ismael mob', {
         *  prefix: true,
         *  fuzzy: 0.2
         * })
         * ```
         *
         * ### Advanced prefix and fuzzy search:
         *
         * ```javascript
         * // Perform fuzzy and prefix search depending on the search term. Here
         * // performing prefix and fuzzy search only on terms longer than 3 characters
         * miniSearch.search('ismael mob', {
         *  prefix: term => term.length > 3
         *  fuzzy: term => term.length > 3 ? 0.2 : null
         * })
         * ```
         *
         * ### Combine with AND:
         *
         * ```javascript
         * // Combine search terms with AND (to match only documents that contain both
         * // "motorcycle" and "art")
         * miniSearch.search('motorcycle art', { combineWith: 'AND' })
         * ```
         *
         * ### Combine with AND_NOT:
         *
         * There is also an AND_NOT combinator, that finds documents that match the
         * first term, but do not match any of the other terms. This combinator is
         * rarely useful with simple queries, and is meant to be used with advanced
         * query combinations (see later for more details).
         *
         * ### Filtering results:
         *
         * ```javascript
         * // Filter only results in the 'fiction' category (assuming that 'category'
         * // is a stored field)
         * miniSearch.search('motorcycle art', {
         *   filter: (result) => result.category === 'fiction'
         * })
         * ```
         *
         * ### Advanced combination of queries:
         *
         * It is possible to combine different subqueries with OR, AND, and AND_NOT,
         * and even with different search options, by passing a query expression
         * tree object as the first argument, instead of a string.
         *
         * ```javascript
         * // Search for documents that contain "zen" and ("motorcycle" or "archery")
         * miniSearch.search({
         *   combineWith: 'AND',
         *   queries: [
         *     'zen',
         *     {
         *       combineWith: 'OR',
         *       queries: ['motorcycle', 'archery']
         *     }
         *   ]
         * })
         *
         * // Search for documents that contain ("apple" or "pear") but not "juice" and
         * // not "tree"
         * miniSearch.search({
         *   combineWith: 'AND_NOT',
         *   queries: [
         *     {
         *       combineWith: 'OR',
         *       queries: ['apple', 'pear']
         *     },
         *     'juice',
         *     'tree'
         *   ]
         * })
         * ```
         *
         * Each node in the expression tree can be either a string, or an object that
         * supports all `SearchOptions` fields, plus a `queries` array field for
         * subqueries.
         *
         * Note that, while this can become complicated to do by hand for complex or
         * deeply nested queries, it provides a formalized expression tree API for
         * external libraries that implement a parser for custom query languages.
         *
         * @param query  Search query
         * @param options  Search options. Each option, if not given, defaults to the corresponding value of `searchOptions` given to the constructor, or to the library default.
         */
        MiniSearch.prototype.search = function (query, searchOptions) {
            var e_8, _a;
            if (searchOptions === void 0) { searchOptions = {}; }
            var combinedResults = this.executeQuery(query, searchOptions);
            var results = [];
            try {
                for (var combinedResults_1 = __values(combinedResults), combinedResults_1_1 = combinedResults_1.next(); !combinedResults_1_1.done; combinedResults_1_1 = combinedResults_1.next()) {
                    var _b = __read(combinedResults_1_1.value, 2), docId = _b[0], _c = _b[1], score = _c.score, terms = _c.terms, match = _c.match;
                    // Final score takes into account the number of matching QUERY terms.
                    // The end user will only receive the MATCHED terms.
                    var quality = terms.length;
                    var result = {
                        id: this._documentIds.get(docId),
                        score: score * quality,
                        terms: Object.keys(match),
                        match: match
                    };
                    Object.assign(result, this._storedFields.get(docId));
                    if (searchOptions.filter == null || searchOptions.filter(result)) {
                        results.push(result);
                    }
                }
            }
            catch (e_8_1) { e_8 = { error: e_8_1 }; }
            finally {
                try {
                    if (combinedResults_1_1 && !combinedResults_1_1.done && (_a = combinedResults_1.return)) _a.call(combinedResults_1);
                }
                finally { if (e_8) throw e_8.error; }
            }
            results.sort(byScore);
            return results;
        };
        /**
         * Provide suggestions for the given search query
         *
         * The result is a list of suggested modified search queries, derived from the
         * given search query, each with a relevance score, sorted by descending score.
         *
         * ### Basic usage:
         *
         * ```javascript
         * // Get suggestions for 'neuro':
         * miniSearch.autoSuggest('neuro')
         * // => [ { suggestion: 'neuromancer', terms: [ 'neuromancer' ], score: 0.46240 } ]
         * ```
         *
         * ### Multiple words:
         *
         * ```javascript
         * // Get suggestions for 'zen ar':
         * miniSearch.autoSuggest('zen ar')
         * // => [
         * //  { suggestion: 'zen archery art', terms: [ 'zen', 'archery', 'art' ], score: 1.73332 },
         * //  { suggestion: 'zen art', terms: [ 'zen', 'art' ], score: 1.21313 }
         * // ]
         * ```
         *
         * ### Fuzzy suggestions:
         *
         * ```javascript
         * // Correct spelling mistakes using fuzzy search:
         * miniSearch.autoSuggest('neromancer', { fuzzy: 0.2 })
         * // => [ { suggestion: 'neuromancer', terms: [ 'neuromancer' ], score: 1.03998 } ]
         * ```
         *
         * ### Filtering:
         *
         * ```javascript
         * // Get suggestions for 'zen ar', but only within the 'fiction' category
         * // (assuming that 'category' is a stored field):
         * miniSearch.autoSuggest('zen ar', {
         *   filter: (result) => result.category === 'fiction'
         * })
         * // => [
         * //  { suggestion: 'zen archery art', terms: [ 'zen', 'archery', 'art' ], score: 1.73332 },
         * //  { suggestion: 'zen art', terms: [ 'zen', 'art' ], score: 1.21313 }
         * // ]
         * ```
         *
         * @param queryString  Query string to be expanded into suggestions
         * @param options  Search options. The supported options and default values
         * are the same as for the `search` method, except that by default prefix
         * search is performed on the last term in the query.
         * @return  A sorted array of suggestions sorted by relevance score.
         */
        MiniSearch.prototype.autoSuggest = function (queryString, options) {
            var e_9, _a, e_10, _b;
            if (options === void 0) { options = {}; }
            options = __assign(__assign({}, defaultAutoSuggestOptions), options);
            var suggestions = new Map();
            try {
                for (var _c = __values(this.search(queryString, options)), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var _e = _d.value, score = _e.score, terms = _e.terms;
                    var phrase = terms.join(' ');
                    var suggestion = suggestions.get(phrase);
                    if (suggestion != null) {
                        suggestion.score += score;
                        suggestion.count += 1;
                    }
                    else {
                        suggestions.set(phrase, { score: score, terms: terms, count: 1 });
                    }
                }
            }
            catch (e_9_1) { e_9 = { error: e_9_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_9) throw e_9.error; }
            }
            var results = [];
            try {
                for (var suggestions_1 = __values(suggestions), suggestions_1_1 = suggestions_1.next(); !suggestions_1_1.done; suggestions_1_1 = suggestions_1.next()) {
                    var _f = __read(suggestions_1_1.value, 2), suggestion = _f[0], _g = _f[1], score = _g.score, terms = _g.terms, count = _g.count;
                    results.push({ suggestion: suggestion, terms: terms, score: score / count });
                }
            }
            catch (e_10_1) { e_10 = { error: e_10_1 }; }
            finally {
                try {
                    if (suggestions_1_1 && !suggestions_1_1.done && (_b = suggestions_1.return)) _b.call(suggestions_1);
                }
                finally { if (e_10) throw e_10.error; }
            }
            results.sort(byScore);
            return results;
        };
        Object.defineProperty(MiniSearch.prototype, "documentCount", {
            /**
             * Number of documents in the index
             */
            get: function () {
                return this._documentCount;
            },
            enumerable: false,
            configurable: true
        });
        /**
         * Deserializes a JSON index (serialized with `JSON.stringify(miniSearch)`)
         * and instantiates a MiniSearch instance. It should be given the same options
         * originally used when serializing the index.
         *
         * ### Usage:
         *
         * ```javascript
         * // If the index was serialized with:
         * let miniSearch = new MiniSearch({ fields: ['title', 'text'] })
         * miniSearch.addAll(documents)
         *
         * const json = JSON.stringify(miniSearch)
         * // It can later be deserialized like this:
         * miniSearch = MiniSearch.loadJSON(json, { fields: ['title', 'text'] })
         * ```
         *
         * @param json  JSON-serialized index
         * @param options  configuration options, same as the constructor
         * @return An instance of MiniSearch deserialized from the given JSON.
         */
        MiniSearch.loadJSON = function (json, options) {
            if (options == null) {
                throw new Error('MiniSearch: loadJSON should be given the same options used when serializing the index');
            }
            return MiniSearch.loadJS(JSON.parse(json), options);
        };
        /**
         * Returns the default value of an option. It will throw an error if no option
         * with the given name exists.
         *
         * @param optionName  Name of the option
         * @return The default value of the given option
         *
         * ### Usage:
         *
         * ```javascript
         * // Get default tokenizer
         * MiniSearch.getDefault('tokenize')
         *
         * // Get default term processor
         * MiniSearch.getDefault('processTerm')
         *
         * // Unknown options will throw an error
         * MiniSearch.getDefault('notExisting')
         * // => throws 'MiniSearch: unknown option "notExisting"'
         * ```
         */
        MiniSearch.getDefault = function (optionName) {
            if (defaultOptions.hasOwnProperty(optionName)) {
                return getOwnProperty(defaultOptions, optionName);
            }
            else {
                throw new Error("MiniSearch: unknown option \"".concat(optionName, "\""));
            }
        };
        /**
         * @ignore
         */
        MiniSearch.loadJS = function (js, options) {
            var e_11, _a, e_12, _b;
            var index = js.index, documentCount = js.documentCount, nextId = js.nextId, documentIds = js.documentIds, fieldIds = js.fieldIds, fieldLength = js.fieldLength, averageFieldLength = js.averageFieldLength, storedFields = js.storedFields, serializationVersion = js.serializationVersion;
            if (serializationVersion !== 1 && serializationVersion !== 2) {
                throw new Error('MiniSearch: cannot deserialize an index created with an incompatible version');
            }
            var miniSearch = new MiniSearch(options);
            miniSearch._documentCount = documentCount;
            miniSearch._nextId = nextId;
            miniSearch._documentIds = objectToNumericMap(documentIds);
            miniSearch._fieldIds = fieldIds;
            miniSearch._fieldLength = objectToNumericMap(fieldLength);
            miniSearch._avgFieldLength = averageFieldLength;
            miniSearch._storedFields = objectToNumericMap(storedFields);
            miniSearch._index = new SearchableMap();
            try {
                for (var index_1 = __values(index), index_1_1 = index_1.next(); !index_1_1.done; index_1_1 = index_1.next()) {
                    var _c = __read(index_1_1.value, 2), term = _c[0], data = _c[1];
                    var dataMap = new Map();
                    try {
                        for (var _d = (e_12 = void 0, __values(Object.keys(data))), _e = _d.next(); !_e.done; _e = _d.next()) {
                            var fieldId = _e.value;
                            var indexEntry = data[fieldId];
                            // Version 1 used to nest the index entry inside a field called ds
                            if (serializationVersion === 1) {
                                indexEntry = indexEntry.ds;
                            }
                            dataMap.set(parseInt(fieldId, 10), objectToNumericMap(indexEntry));
                        }
                    }
                    catch (e_12_1) { e_12 = { error: e_12_1 }; }
                    finally {
                        try {
                            if (_e && !_e.done && (_b = _d.return)) _b.call(_d);
                        }
                        finally { if (e_12) throw e_12.error; }
                    }
                    miniSearch._index.set(term, dataMap);
                }
            }
            catch (e_11_1) { e_11 = { error: e_11_1 }; }
            finally {
                try {
                    if (index_1_1 && !index_1_1.done && (_a = index_1.return)) _a.call(index_1);
                }
                finally { if (e_11) throw e_11.error; }
            }
            return miniSearch;
        };
        /**
         * @ignore
         */
        MiniSearch.prototype.executeQuery = function (query, searchOptions) {
            var _this = this;
            if (searchOptions === void 0) { searchOptions = {}; }
            if (typeof query !== 'string') {
                var options_1 = __assign(__assign(__assign({}, searchOptions), query), { queries: undefined });
                var results_1 = query.queries.map(function (subquery) { return _this.executeQuery(subquery, options_1); });
                return this.combineResults(results_1, query.combineWith);
            }
            var _a = this._options, tokenize = _a.tokenize, processTerm = _a.processTerm, globalSearchOptions = _a.searchOptions;
            var options = __assign(__assign({ tokenize: tokenize, processTerm: processTerm }, globalSearchOptions), searchOptions);
            var searchTokenize = options.tokenize, searchProcessTerm = options.processTerm;
            var terms = searchTokenize(query)
                .map(function (term) { return searchProcessTerm(term); })
                .filter(function (term) { return !!term; });
            var queries = terms.map(termToQuerySpec(options));
            var results = queries.map(function (query) { return _this.executeQuerySpec(query, options); });
            return this.combineResults(results, options.combineWith);
        };
        /**
         * @ignore
         */
        MiniSearch.prototype.executeQuerySpec = function (query, searchOptions) {
            var e_13, _a, e_14, _b;
            var options = __assign(__assign({}, this._options.searchOptions), searchOptions);
            var boosts = (options.fields || this._options.fields).reduce(function (boosts, field) {
                var _a;
                return (__assign(__assign({}, boosts), (_a = {}, _a[field] = getOwnProperty(boosts, field) || 1, _a)));
            }, options.boost || {});
            var boostDocument = options.boostDocument, weights = options.weights, maxFuzzy = options.maxFuzzy;
            var _c = __assign(__assign({}, defaultSearchOptions.weights), weights), fuzzyWeight = _c.fuzzy, prefixWeight = _c.prefix;
            var data = this._index.get(query.term);
            var results = this.termResults(query.term, query.term, 1, data, boosts, boostDocument);
            var prefixMatches;
            var fuzzyMatches;
            if (query.prefix) {
                prefixMatches = this._index.atPrefix(query.term);
            }
            if (query.fuzzy) {
                var fuzzy = (query.fuzzy === true) ? 0.2 : query.fuzzy;
                var maxDistance = fuzzy < 1 ? Math.min(maxFuzzy, Math.round(query.term.length * fuzzy)) : fuzzy;
                if (maxDistance)
                    fuzzyMatches = this._index.fuzzyGet(query.term, maxDistance);
            }
            if (prefixMatches) {
                try {
                    for (var prefixMatches_1 = __values(prefixMatches), prefixMatches_1_1 = prefixMatches_1.next(); !prefixMatches_1_1.done; prefixMatches_1_1 = prefixMatches_1.next()) {
                        var _d = __read(prefixMatches_1_1.value, 2), term = _d[0], data_1 = _d[1];
                        var distance = term.length - query.term.length;
                        if (!distance) {
                            continue;
                        } // Skip exact match.
                        // Delete the term from fuzzy results (if present) if it is also a
                        // prefix result. This entry will always be scored as a prefix result.
                        fuzzyMatches === null || fuzzyMatches === void 0 ? void 0 : fuzzyMatches.delete(term);
                        // Weight gradually approaches 0 as distance goes to infinity, with the
                        // weight for the hypothetical distance 0 being equal to prefixWeight.
                        // The rate of change is much lower than that of fuzzy matches to
                        // account for the fact that prefix matches stay more relevant than
                        // fuzzy matches for longer distances.
                        var weight = prefixWeight * term.length / (term.length + 0.3 * distance);
                        this.termResults(query.term, term, weight, data_1, boosts, boostDocument, results);
                    }
                }
                catch (e_13_1) { e_13 = { error: e_13_1 }; }
                finally {
                    try {
                        if (prefixMatches_1_1 && !prefixMatches_1_1.done && (_a = prefixMatches_1.return)) _a.call(prefixMatches_1);
                    }
                    finally { if (e_13) throw e_13.error; }
                }
            }
            if (fuzzyMatches) {
                try {
                    for (var _e = __values(fuzzyMatches.keys()), _f = _e.next(); !_f.done; _f = _e.next()) {
                        var term = _f.value;
                        var _g = __read(fuzzyMatches.get(term), 2), data_2 = _g[0], distance = _g[1];
                        if (!distance) {
                            continue;
                        } // Skip exact match.
                        // Weight gradually approaches 0 as distance goes to infinity, with the
                        // weight for the hypothetical distance 0 being equal to fuzzyWeight.
                        var weight = fuzzyWeight * term.length / (term.length + distance);
                        this.termResults(query.term, term, weight, data_2, boosts, boostDocument, results);
                    }
                }
                catch (e_14_1) { e_14 = { error: e_14_1 }; }
                finally {
                    try {
                        if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                    }
                    finally { if (e_14) throw e_14.error; }
                }
            }
            return results;
        };
        /**
         * @ignore
         */
        MiniSearch.prototype.combineResults = function (results, combineWith) {
            if (combineWith === void 0) { combineWith = OR; }
            if (results.length === 0) {
                return new Map();
            }
            var operator = combineWith.toLowerCase();
            return results.reduce(combinators[operator]) || new Map();
        };
        /**
         * Allows serialization of the index to JSON, to possibly store it and later
         * deserialize it with `MiniSearch.loadJSON`.
         *
         * Normally one does not directly call this method, but rather call the
         * standard JavaScript `JSON.stringify()` passing the `MiniSearch` instance,
         * and JavaScript will internally call this method. Upon deserialization, one
         * must pass to `loadJSON` the same options used to create the original
         * instance that was serialized.
         *
         * ### Usage:
         *
         * ```javascript
         * // Serialize the index:
         * let miniSearch = new MiniSearch({ fields: ['title', 'text'] })
         * miniSearch.addAll(documents)
         * const json = JSON.stringify(miniSearch)
         *
         * // Later, to deserialize it:
         * miniSearch = MiniSearch.loadJSON(json, { fields: ['title', 'text'] })
         * ```
         *
         * @return A plain-object serializeable representation of the search index.
         */
        MiniSearch.prototype.toJSON = function () {
            var e_15, _a, e_16, _b;
            var index = [];
            try {
                for (var _c = __values(this._index), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var _e = __read(_d.value, 2), term = _e[0], fieldIndex = _e[1];
                    var data = {};
                    try {
                        for (var fieldIndex_1 = (e_16 = void 0, __values(fieldIndex)), fieldIndex_1_1 = fieldIndex_1.next(); !fieldIndex_1_1.done; fieldIndex_1_1 = fieldIndex_1.next()) {
                            var _f = __read(fieldIndex_1_1.value, 2), fieldId = _f[0], freqs = _f[1];
                            data[fieldId] = Object.fromEntries(freqs);
                        }
                    }
                    catch (e_16_1) { e_16 = { error: e_16_1 }; }
                    finally {
                        try {
                            if (fieldIndex_1_1 && !fieldIndex_1_1.done && (_b = fieldIndex_1.return)) _b.call(fieldIndex_1);
                        }
                        finally { if (e_16) throw e_16.error; }
                    }
                    index.push([term, data]);
                }
            }
            catch (e_15_1) { e_15 = { error: e_15_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_15) throw e_15.error; }
            }
            return {
                documentCount: this._documentCount,
                nextId: this._nextId,
                documentIds: Object.fromEntries(this._documentIds),
                fieldIds: this._fieldIds,
                fieldLength: Object.fromEntries(this._fieldLength),
                averageFieldLength: this._avgFieldLength,
                storedFields: Object.fromEntries(this._storedFields),
                index: index,
                serializationVersion: 2
            };
        };
        /**
         * @ignore
         */
        MiniSearch.prototype.termResults = function (sourceTerm, derivedTerm, termWeight, fieldTermData, fieldBoosts, boostDocumentFn, results) {
            var e_17, _a, e_18, _b, _c;
            if (results === void 0) { results = new Map(); }
            if (fieldTermData == null)
                return results;
            try {
                for (var _d = __values(Object.keys(fieldBoosts)), _e = _d.next(); !_e.done; _e = _d.next()) {
                    var field = _e.value;
                    var fieldBoost = fieldBoosts[field];
                    var fieldId = this._fieldIds[field];
                    var fieldTermFreqs = fieldTermData.get(fieldId);
                    if (fieldTermFreqs == null)
                        continue;
                    var matchingFields = fieldTermFreqs.size;
                    var avgFieldLength = this._avgFieldLength[fieldId];
                    try {
                        for (var _f = (e_18 = void 0, __values(fieldTermFreqs.keys())), _g = _f.next(); !_g.done; _g = _f.next()) {
                            var docId = _g.value;
                            var docBoost = boostDocumentFn ? boostDocumentFn(this._documentIds.get(docId), derivedTerm) : 1;
                            if (!docBoost)
                                continue;
                            var termFreq = fieldTermFreqs.get(docId);
                            var fieldLength = this._fieldLength.get(docId)[fieldId];
                            // NOTE: The total number of fields is set to the number of documents
                            // `this._documentCount`. It could also make sense to use the number of
                            // documents where the current field is non-blank as a normalisation
                            // factor. This will make a difference in scoring if the field is rarely
                            // present. This is currently not supported, and may require further
                            // analysis to see if it is a valid use case.
                            var rawScore = calcBM25Score(termFreq, matchingFields, this._documentCount, fieldLength, avgFieldLength);
                            var weightedScore = termWeight * fieldBoost * docBoost * rawScore;
                            var result = results.get(docId);
                            if (result) {
                                result.score += weightedScore;
                                assignUniqueTerm(result.terms, sourceTerm);
                                var match = getOwnProperty(result.match, derivedTerm);
                                if (match) {
                                    match.push(field);
                                }
                                else {
                                    result.match[derivedTerm] = [field];
                                }
                            }
                            else {
                                results.set(docId, {
                                    score: weightedScore,
                                    terms: [sourceTerm],
                                    match: (_c = {}, _c[derivedTerm] = [field], _c)
                                });
                            }
                        }
                    }
                    catch (e_18_1) { e_18 = { error: e_18_1 }; }
                    finally {
                        try {
                            if (_g && !_g.done && (_b = _f.return)) _b.call(_f);
                        }
                        finally { if (e_18) throw e_18.error; }
                    }
                }
            }
            catch (e_17_1) { e_17 = { error: e_17_1 }; }
            finally {
                try {
                    if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
                }
                finally { if (e_17) throw e_17.error; }
            }
            return results;
        };
        /**
         * @ignore
         */
        MiniSearch.prototype.addTerm = function (fieldId, documentId, term) {
            var indexData = this._index.fetch(term, createMap);
            var fieldIndex = indexData.get(fieldId);
            if (fieldIndex == null) {
                fieldIndex = new Map();
                fieldIndex.set(documentId, 1);
                indexData.set(fieldId, fieldIndex);
            }
            else {
                var docs = fieldIndex.get(documentId);
                fieldIndex.set(documentId, (docs || 0) + 1);
            }
        };
        /**
         * @ignore
         */
        MiniSearch.prototype.removeTerm = function (fieldId, documentId, term) {
            if (!this._index.has(term)) {
                this.warnDocumentChanged(documentId, fieldId, term);
                return;
            }
            var indexData = this._index.fetch(term, createMap);
            var fieldIndex = indexData.get(fieldId);
            if (fieldIndex == null || fieldIndex.get(documentId) == null) {
                this.warnDocumentChanged(documentId, fieldId, term);
            }
            else if (fieldIndex.get(documentId) <= 1) {
                if (fieldIndex.size <= 1) {
                    indexData.delete(fieldId);
                }
                else {
                    fieldIndex.delete(documentId);
                }
            }
            else {
                fieldIndex.set(documentId, fieldIndex.get(documentId) - 1);
            }
            if (this._index.get(term).size === 0) {
                this._index.delete(term);
            }
        };
        /**
         * @ignore
         */
        MiniSearch.prototype.warnDocumentChanged = function (shortDocumentId, fieldId, term) {
            var e_19, _a;
            if (console == null || console.warn == null) {
                return;
            }
            try {
                for (var _b = __values(Object.keys(this._fieldIds)), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var fieldName = _c.value;
                    if (this._fieldIds[fieldName] === fieldId) {
                        console.warn("MiniSearch: document with ID ".concat(this._documentIds.get(shortDocumentId), " has changed before removal: term \"").concat(term, "\" was not present in field \"").concat(fieldName, "\". Removing a document after it has changed can corrupt the index!"));
                        return;
                    }
                }
            }
            catch (e_19_1) { e_19 = { error: e_19_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_19) throw e_19.error; }
            }
        };
        /**
         * @ignore
         */
        MiniSearch.prototype.addDocumentId = function (documentId) {
            var shortDocumentId = this._nextId;
            this._documentIds.set(shortDocumentId, documentId);
            this._documentCount += 1;
            this._nextId += 1;
            return shortDocumentId;
        };
        /**
         * @ignore
         */
        MiniSearch.prototype.addFields = function (fields) {
            for (var i = 0; i < fields.length; i++) {
                this._fieldIds[fields[i]] = i;
            }
        };
        /**
         * @ignore
         */
        MiniSearch.prototype.addFieldLength = function (documentId, fieldId, count, length) {
            var fieldLengths = this._fieldLength.get(documentId);
            if (fieldLengths == null)
                this._fieldLength.set(documentId, fieldLengths = []);
            fieldLengths[fieldId] = length;
            var averageFieldLength = this._avgFieldLength[fieldId] || 0;
            var totalFieldLength = (averageFieldLength * count) + length;
            this._avgFieldLength[fieldId] = totalFieldLength / (count + 1);
        };
        /**
         * @ignore
         */
        MiniSearch.prototype.removeFieldLength = function (documentId, fieldId, count, length) {
            var totalFieldLength = (this._avgFieldLength[fieldId] * count) - length;
            this._avgFieldLength[fieldId] = totalFieldLength / (count - 1);
        };
        /**
         * @ignore
         */
        MiniSearch.prototype.saveStoredFields = function (documentId, doc) {
            var e_20, _a;
            var _b = this._options, storeFields = _b.storeFields, extractField = _b.extractField;
            if (storeFields == null || storeFields.length === 0) {
                return;
            }
            var documentFields = this._storedFields.get(documentId);
            if (documentFields == null)
                this._storedFields.set(documentId, documentFields = {});
            try {
                for (var storeFields_1 = __values(storeFields), storeFields_1_1 = storeFields_1.next(); !storeFields_1_1.done; storeFields_1_1 = storeFields_1.next()) {
                    var fieldName = storeFields_1_1.value;
                    var fieldValue = extractField(doc, fieldName);
                    if (fieldValue !== undefined)
                        documentFields[fieldName] = fieldValue;
                }
            }
            catch (e_20_1) { e_20 = { error: e_20_1 }; }
            finally {
                try {
                    if (storeFields_1_1 && !storeFields_1_1.done && (_a = storeFields_1.return)) _a.call(storeFields_1);
                }
                finally { if (e_20) throw e_20.error; }
            }
        };
        return MiniSearch;
    }());
    var getOwnProperty = function (object, property) {
        return Object.prototype.hasOwnProperty.call(object, property) ? object[property] : undefined;
    };
    var combinators = (_a = {},
        _a[OR] = function (a, b) {
            var e_21, _a;
            try {
                for (var _b = __values(b.keys()), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var docId = _c.value;
                    var existing = a.get(docId);
                    if (existing == null) {
                        a.set(docId, b.get(docId));
                    }
                    else {
                        var _d = b.get(docId), score = _d.score, terms = _d.terms, match = _d.match;
                        existing.score = existing.score + score;
                        existing.match = Object.assign(existing.match, match);
                        assignUniqueTerms(existing.terms, terms);
                    }
                }
            }
            catch (e_21_1) { e_21 = { error: e_21_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_21) throw e_21.error; }
            }
            return a;
        },
        _a[AND] = function (a, b) {
            var e_22, _a;
            var combined = new Map();
            try {
                for (var _b = __values(b.keys()), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var docId = _c.value;
                    var existing = a.get(docId);
                    if (existing == null)
                        continue;
                    var _d = b.get(docId), score = _d.score, terms = _d.terms, match = _d.match;
                    assignUniqueTerms(existing.terms, terms);
                    combined.set(docId, {
                        score: existing.score + score,
                        terms: existing.terms,
                        match: Object.assign(existing.match, match)
                    });
                }
            }
            catch (e_22_1) { e_22 = { error: e_22_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_22) throw e_22.error; }
            }
            return combined;
        },
        _a[AND_NOT] = function (a, b) {
            var e_23, _a;
            try {
                for (var _b = __values(b.keys()), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var docId = _c.value;
                    a.delete(docId);
                }
            }
            catch (e_23_1) { e_23 = { error: e_23_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_23) throw e_23.error; }
            }
            return a;
        },
        _a);
    // https://en.wikipedia.org/wiki/Okapi_BM25
    // https://opensourceconnections.com/blog/2015/10/16/bm25-the-next-generation-of-lucene-relevation/
    var k = 1.2; // Term frequency saturation point. Recommended values are between 1.2 and 2.
    var b = 0.7; // Length normalization impact. Recommended values are around 0.75.
    var d = 0.5; // BM25+ frequency normalization lower bound. Recommended values are between 0.5 and 1.
    var calcBM25Score = function (termFreq, matchingCount, totalCount, fieldLength, avgFieldLength) {
        var invDocFreq = Math.log(1 + (totalCount - matchingCount + 0.5) / (matchingCount + 0.5));
        return invDocFreq * (d + termFreq * (k + 1) / (termFreq + k * (1 - b + b * fieldLength / avgFieldLength)));
    };
    var termToQuerySpec = function (options) { return function (term, i, terms) {
        var fuzzy = (typeof options.fuzzy === 'function')
            ? options.fuzzy(term, i, terms)
            : (options.fuzzy || false);
        var prefix = (typeof options.prefix === 'function')
            ? options.prefix(term, i, terms)
            : (options.prefix === true);
        return { term: term, fuzzy: fuzzy, prefix: prefix };
    }; };
    var defaultOptions = {
        idField: 'id',
        extractField: function (document, fieldName) { return document[fieldName]; },
        tokenize: function (text, fieldName) { return text.split(SPACE_OR_PUNCTUATION); },
        processTerm: function (term, fieldName) { return term.toLowerCase(); },
        fields: undefined,
        searchOptions: undefined,
        storeFields: []
    };
    var defaultSearchOptions = {
        combineWith: OR,
        prefix: false,
        fuzzy: false,
        maxFuzzy: 6,
        boost: {},
        weights: { fuzzy: 0.45, prefix: 0.375 }
    };
    var defaultAutoSuggestOptions = {
        prefix: function (term, i, terms) {
            return i === terms.length - 1;
        }
    };
    var assignUniqueTerm = function (target, term) {
        // Avoid adding duplicate terms.
        if (!target.includes(term))
            target.push(term);
    };
    var assignUniqueTerms = function (target, source) {
        var e_24, _a;
        try {
            for (var source_1 = __values(source), source_1_1 = source_1.next(); !source_1_1.done; source_1_1 = source_1.next()) {
                var term = source_1_1.value;
                // Avoid adding duplicate terms.
                if (!target.includes(term))
                    target.push(term);
            }
        }
        catch (e_24_1) { e_24 = { error: e_24_1 }; }
        finally {
            try {
                if (source_1_1 && !source_1_1.done && (_a = source_1.return)) _a.call(source_1);
            }
            finally { if (e_24) throw e_24.error; }
        }
    };
    var byScore = function (_a, _b) {
        var a = _a.score;
        var b = _b.score;
        return b - a;
    };
    var createMap = function () { return new Map(); };
    var objectToNumericMap = function (object) {
        var e_25, _a;
        var map = new Map();
        try {
            for (var _b = __values(Object.keys(object)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var key = _c.value;
                map.set(parseInt(key, 10), object[key]);
            }
        }
        catch (e_25_1) { e_25 = { error: e_25_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_25) throw e_25.error; }
        }
        return map;
    };
    // This regular expression matches any Unicode space or punctuation character
    // Adapted from https://unicode.org/cldr/utility/list-unicodeset.jsp?a=%5Cp%7BZ%7D%5Cp%7BP%7D&abb=on&c=on&esc=on
    var SPACE_OR_PUNCTUATION = /[\n\r -#%-*,-/:;?@[-\]_{}\u00A0\u00A1\u00A7\u00AB\u00B6\u00B7\u00BB\u00BF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C77\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166E\u1680\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2000-\u200A\u2010-\u2029\u202F-\u2043\u2045-\u2051\u2053-\u205F\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4F\u3000-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]+/u;

    var waivers_data = [
    	{
    		_id: "624462261d5c030ceac2b027",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Purchase of a 1096nm Laser System",
    			summaryOfProcurement: "A high-power, spectrally narrow source of laser light that is tunable for wavelengths from 1096.4 nm to 1096.8 nm.  This procurement seeks a laser capable of producing these wavelengths at high power with long-term frequency stability.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: "1333ND22PNB680119"
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "No Domestic product has been identified that can meet the Governments requirements. The combined synopsis/solicitation included FAR 52.225-3, Buy American-Free Trade Agreements-Israeli Trade Act with Alternate I. France does not fall under any of these trade agreements nor did the offeror certify compliance. ",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "FR",
    						Three: "FRA",
    						Numeric: 250,
    						Name: "FRANCE"
    					}
    				}
    			],
    			solicitationId: "1333ND22QNB680076"
    		},
    		created: "2022-03-30T13:59:02.229Z",
    		modified: "2022-03-30T20:18:40.027Z"
    	},
    	{
    		_id: "624220355b9678fdc1be79ec",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1700",
    			contractingOfficeAgencyName: "DEPT OF THE NAVY",
    			fundingAgencyId: "1700",
    			fundingAgencyName: "DEPT OF THE NAVY",
    			naics: {
    				NAICS_Code: 238990,
    				NAICS_Title: "All Other Specialty Trade Contractors"
    			},
    			psc: {
    				pscId: 3418,
    				pscCode: "H241",
    				pscName: "EQUIPMENT AND MATERIALS TESTING- REFRIGERATION, AIR CONDITIONING, AND AIR CIRCULATING EQUIPMENT"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Dixon Various Repairs and Travis Tank Repairs",
    			summaryOfProcurement: "Task order N6237421F5421 was awarded 10 September 2021 to Heffler Contracting Group, which required them to perform various repairs at Dixon Naval Radio Transmission Facility (NRTF) in Dixon, California, as well as repair tanks at Travis, Air Force Base (AFB). Part of the specification required the Contractor to provide all management, tools, supplies, equipment, and labor necessary to install two (2) \n2-1/2 ton ductless mini-split Heating, Ventilation, and Air Conditioning (HVAC) units in offices spaces 110A and 110C in building 10. This was part of option four (4) which was exercised 23 November 2021. After awarding the contract, Heffler Contracting Group became aware that the mini-split HVAC systems are not mined, produced, or manufactured in the United States. NAVFAC SW performed rigorous Market Research to identify domestically manufactured items capable of satisfying the requirement (Encl. 1). The results of the market research demonstrated that the primary places of manufacture for the mini-split HVAC units are foreign. NAVFAC SW seeks to install multiple ductless split system air conditioning units in its operations and computer server rooms at Dixon Naval Radio Transmission Facility (NRTF) and Travis Air Force Base. These units will regulate environmental conditions in areas with specific temperature and/or humidity requirements, such as server rooms where conventional ductwork is not possible.",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: "N6237421F5421"
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "The Dixon NRTF is part of the Navy’s critical communication infrastructure with equipment that requires specific environmental and temperature requirements to be maintained. The HVAC mini-split air conditioning systems are required. The facility cannot use a standard split system unit, as an alternative to the ductless split system, because a standard system is incapable of treating ventilation air and the required ductwork cannot be installed in locations that need environmental control. There is no domestic manufacturer that would satisfy the project needs. Based on the historic cost information currently available, the contracting officer has adequate information to ensure that the cost to the Government for this acquisition will be fair and reasonable. The need for standardization on these buildings is required as these systems are used in computer server rooms throughout the US Military and government offices.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Between 6 months and 1 year",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "JP",
    						Three: "JPN",
    						Numeric: 392,
    						Name: "JAPAN"
    					}
    				}
    			],
    			solicitationId: "N6247321D1018 X001"
    		},
    		created: "2022-03-28T20:53:09.312Z",
    		modified: "2022-03-29T19:25:41.067Z"
    	},
    	{
    		_id: "624314d586709587e612a80b",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1434",
    			contractingOfficeAgencyName: "US GEOLOGICAL SURVEY",
    			fundingAgencyId: "1434",
    			fundingAgencyName: "US GEOLOGICAL SURVEY",
    			naics: {
    				NAICS_Code: 334513,
    				NAICS_Title: "Instruments and Related Products Manufacturing for Measuring, Displaying, and Controlling Industrial Process Variables "
    			},
    			psc: {
    				pscId: 781,
    				pscCode: "6625",
    				pscName: "ELECTRICAL AND ELECTRONIC PROPERTIES MEASURING AND TESTING INSTRUMENTS"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Twelve (12) GEM Systems GSM-19W Overhauser magnetometers with GPS",
    			summaryOfProcurement: "The GHSC is currently upgrading its geomagnetic data acquisition systems and requires procurement of twelve (12) GEM Systems GSM-19W Overhauser magnetometers with GPS Option A for the USGS Geomagnetism Program Magnetic Observatory network across the U.S. and Guam. The GSM-19W is currently in use at each of the USGS magnetic observatories, but many are starting to fail due to age.",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "RFQ 140G0222Q0031 received quotations from nine (9), US based small business, Resellers. Each of the nine (9) vendors are receiving the GSM-19W Overhauser magnetometers from the Canadian Manufacturer, GEM Systems.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			]
    		},
    		created: "2022-03-29T14:16:53.767Z",
    		modified: "2022-03-29T19:34:12.835Z"
    	},
    	{
    		_id: "62431d711d5c030ceac2ad6c",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1434",
    			contractingOfficeAgencyName: "US GEOLOGICAL SURVEY",
    			fundingAgencyId: "1434",
    			fundingAgencyName: "US GEOLOGICAL SURVEY",
    			naics: {
    				NAICS_Code: 334519,
    				NAICS_Title: "Other Measuring and Controlling Device Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Three-component nodal seismographs",
    			summaryOfProcurement: "Fifty (50) SmartSolo IGU-16HR 3C nodal seismographs",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "DOI have used the SmartSolo nodal seismometers to map subsurface groundwater variations in multiple places, but in many of those studies, the lateral extent of the groundwater variations could not be fully determined with the limited number of ESC nodal seismometers; we need more nodal seismometers, which can minimize time in the field, field expenses, and the amount of work required.  The USGS Earthquake Science Center (ESC) uses nodal seismometers for multiple mission critical purposes, including (a) to detect and locate earthquakes, (b) to locate and detect earthquake faults, and (c) to map locate subsurface groundwater and other resources. ESC currently has about 500 SmartSolo 3C nodal seismometers to conduct the above-mentioned mission-critical work. It is estimated that a minimal of about 1000 SmartSolo nodal seismometers are needed. If DOI does not increase the number of ESC SmartSolo nodal seismometers, parts of ESC’s work will be slower and more inaccurate.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			]
    		},
    		created: "2022-03-29T14:53:37.355Z",
    		modified: "2022-03-29T19:36:31.107Z"
    	},
    	{
    		_id: "624337731d5c030ceac2ad99",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "BLS Upgrade",
    			summaryOfProcurement: "The National Institute of Standards and Technology (NIST), Physical Measurement Laboratory (PML), Quantum Electromagnetics Division (QED) has a mission to provide the metrological foundation for emerging electronic, magnetic, and photonic technologies by developing high-precision measurement devices, systems, standards, and methodologies and applying them to address national needs. The QED is developing new measurement capability to support magnetic random-access memories, novel spin-based technologies, and on-chip microwave devices. To facilitate support of this effort, the NIST QED must upgrade the current Brillouin light scattering (BLS) spectrometer hardware and software to include both a micro-focused beam and a time-resolved capability compatible with the existing system.",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: "1333ND22PNB680108"
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "DETERMINATION\nBased on the findings, there are no vendors who provide a domestic end product for the upgrade. Therefore, I have determined that the required end product is not mined, produced, or manufactured in the United States in sufficient and reasonably available commercial quantities of satisfactory quality that meet all the NIST requirements. This results in determining that the required BLS upgrade shall be treated as a domestic article for this procurement.\nAuthority is hereby granted to procure the above-described foreign end product at a total price of $91,390.00, inclusive of transportation costs to destination.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "DE",
    						Three: "DEU",
    						Numeric: 276,
    						Name: "GERMANY"
    					}
    				}
    			],
    			solicitationId: "NB687040-22-00698"
    		},
    		created: "2022-03-29T16:44:35.215Z",
    		modified: "2022-03-29T19:44:56.124Z"
    	},
    	{
    		_id: "622f3d4b5f02f4943ba59650",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 334519,
    				NAICS_Title: "Other Measuring and Controlling Device Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Force Transducers ",
    			summaryOfProcurement: "Purchase two (2) force transducers of 5 kN capacity , two (2) transducers of 10 kN capacity, two (2) transducers of 1 MN capacity.",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: "1333ND22PNB680101 "
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "No Domestic product has been identified that can meet the Governments requirements",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "DE",
    						Three: "DEU",
    						Numeric: 276,
    						Name: "GERMANY"
    					}
    				}
    			],
    			solicitationId: "1333ND22QNB680071"
    		},
    		created: "2022-03-14T13:04:11.881Z",
    		modified: "2022-03-15T19:25:33.559Z"
    	},
    	{
    		_id: "62324b04eca171d8fbf2e433",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "12K3",
    			contractingOfficeAgencyName: "ANIMAL AND PLANT HEALTH INSPECTION SERVICE",
    			fundingAgencyId: "12K3",
    			fundingAgencyName: "ANIMAL AND PLANT HEALTH INSPECTION SERVICE",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Sequencing Systems",
    			summaryOfProcurement: "This requirement is for the United States Department of Agriculture (USDA), Animal Plant Health and Inspection Service (APHIS), Veterinary Services (VS). As the Nation's veterinary authority, Veterinary Services improves the health, productivity, and quality of life for animals and people, and maintains and promotes the safety and availability of animals, animal products, and veterinary biologics.  The objective of this acquisition is to obtain sequencing systems for use at the National Bio and Agro‐Defense Facility\n(NBAF) located in Manhattan, KS.  Equipment includes one (1) PromethION 48, PRM48BasicSP with compute model device, one (1) GridION Mk1 device, and three (3) MinION devices. The manufacturer of this equipment is Oxford Nanopore Technologies plc, Gosling Building, Edmund Halley Road, Oxford Science Park, OX4 4DQ, United Kingdom.  No other known products can meet the\nGovernment’s salient characteristics requirements, and there is only one (1) authorized distributor for the original equipment manufacturer (OEM) that can fulfill all of the requirements of this acquisition.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "This is a one-time requirement. The anticipated period of performance is 60 days after award.",
    			expectedMaximumDurationOfTheRequestedWaiver: "0 - 6 months",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			]
    		},
    		created: "2022-03-16T20:39:32.248Z",
    		modified: "2022-03-21T12:29:11.556Z"
    	},
    	{
    		_id: "6233bc71784402ac03e5e21e",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "8900",
    			contractingOfficeAgencyName: "ENERGY, DEPARTMENT OF",
    			fundingAgencyId: "8900",
    			fundingAgencyName: "ENERGY, DEPARTMENT OF",
    			naics: {
    				NAICS_Code: 327110,
    				NAICS_Title: "Pottery, Ceramics, and Plumbing Fixture Manufacturing "
    			},
    			psc: {
    				pscId: 667,
    				pscCode: "5970",
    				pscName: "ELECTRICAL INSULATORS AND INSULATING MATERIALS"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Porcelain, Glass, and Composite Insulator IDIQ",
    			summaryOfProcurement: "The procurement is for a WAPA -Wide Insulator IDIQ contract for porcelain, glass, and composite insulators. Insulators are required to hold the transmission line, i.e. conductors in position, separating them from one another and from surrounding structures.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Multi-procurement Waiver",
    			waiverRationaleSummary: "A  waiver is requested because of the unavailability of US manufactured porcelain insulators.  The 8(a) small business has reached out to the manufacturers of porcelain, glass, and composite insulators, and has determined porcelain insulators are only manufactured in Italy, China and Romania.  Domestically manufactured glass and composite insulators are available, but porcelain insulators are not domestically manufactured.  Polymer and glass are not used as a direct replacement for porcelain insulators.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Between 3 and 5 years",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "RO",
    						Three: "ROU",
    						Numeric: 642,
    						Name: "ROMANIA"
    					}
    				},
    				{
    					countryOfOriginAndUSContent: {
    						Two: "CN",
    						Three: "CHN",
    						Numeric: 156,
    						Name: "CHINA"
    					}
    				},
    				{
    					countryOfOriginAndUSContent: {
    						Two: "IT",
    						Three: "ITA",
    						Numeric: 380,
    						Name: "ITALY"
    					}
    				}
    			],
    			solicitationId: "89503422QWA000480"
    		},
    		created: "2022-03-17T22:55:45.867Z",
    		modified: "2022-03-30T20:18:04.478Z"
    	},
    	{
    		_id: "6234c3c811ee2ae7c28ac0ed",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Purchase of additional Honeywell sensors for an existing Honeywell Toxic Gas Monitoring System",
    			summaryOfProcurement: "Upgrade of additional Honeywell sensors for an existing Honeywell Toxic Gas Monitoring System\n",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: "1333ND22PNB680103"
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "No Domestic product has been identified that can meet the Governments requirements\n",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "GB",
    						Three: "GBR",
    						Numeric: 826,
    						Name: "UNITED KINGDOM"
    					}
    				}
    			],
    			solicitationId: "NB680000-22-01118"
    		},
    		created: "2022-03-18T17:39:20.642Z",
    		modified: "2022-03-21T12:32:49.072Z"
    	},
    	{
    		_id: "623b5086784402ac03e61f72",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "12K3",
    			contractingOfficeAgencyName: "ANIMAL AND PLANT HEALTH INSPECTION SERVICE",
    			fundingAgencyId: "12K3",
    			fundingAgencyName: "ANIMAL AND PLANT HEALTH INSPECTION SERVICE",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Dissociator with Heater",
    			summaryOfProcurement: "This requirement is for the United States Department of Agriculture (USDA)  Animal and Plant Health Inspection Service (APHIS) Veterinary Services (VS). As the Nation's veterinary authority, VS improves the health, productivity, and quality of life for animals and people, and maintains and promotes the safety and availability of animals, animal products, and veterinary biologics. The objective of this acquisition is to obtain six (6) gentleMACS Oct Dissociator instruments to perform semi-automated and standardized tissue dissociation or homogenization. This equipment is for use at the National Bio and Agro-Defense Facility (NBAF) located in Manhattan, KS. The gentleMACS Oct Dissociator instrument is manufactured by Miltenyi Biotec B.V. & Co. KG,\nFredrich‐Ebert‐Str. 68, 51429 Bergisch Gladbach, Germany. No other known products can meet the Government’s salient characteristic requirements. The equipment can be procured only from Miltenyi Biotec Inc., 1201 Clopper Road, Gaithersburg, MD 20878 (DUNS 808605919), the sole authorized distributor for the original equipment manufacturer (OEM).",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "The objective of this acquisition is to obtain six (6) gentleMACS Oct Dissociator instruments. manufactured by Miltenyi Biotec B.V. & Co. KG, Fredrich‐Ebert‐Str. 68, 51429 Bergisch Gladbach, Germany. No other known products can meet the Government’s salient characteristic requirements. Delivery of these instruments is required within 45 days after the contract award date.",
    			expectedMaximumDurationOfTheRequestedWaiver: "0 - 6 months",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			]
    		},
    		created: "2022-03-23T16:53:26.423Z",
    		modified: "2022-03-29T19:47:02.682Z"
    	},
    	{
    		_id: "624461371d5c030ceac2b00e",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1434",
    			contractingOfficeAgencyName: "US GEOLOGICAL SURVEY",
    			fundingAgencyId: "1434",
    			fundingAgencyName: "US GEOLOGICAL SURVEY",
    			naics: {
    				NAICS_Code: 334519,
    				NAICS_Title: "Other Measuring and Controlling Device Manufacturing"
    			},
    			psc: {
    				pscId: 674,
    				pscCode: "5985",
    				pscName: "ANTENNAS, WAVEGUIDES, AND RELATED EQUIPMENT"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "GPS data logging transmitters with remote data download capability",
    			summaryOfProcurement: "bird migration loggers - small GPS data logging transmitters with remote data download capability and location-based programming - Uria-100 LP with solar panel GPS-UHF, 15 qty. , dive sensors, qty. 15 and Ecotone STERNA GPS-UHF, qty. 15.",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "If the Alaska Science Center does not obtain the required equipment (i.e., additional GPS transmitters) they will not be able to obtain enough GPS tag deployments to provide insight on the recovery of seabirds and forage fish from the marine heatwave of 2014-2016.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			]
    		},
    		created: "2022-03-30T13:55:03.781Z",
    		modified: "2022-04-05T15:46:34.145Z"
    	},
    	{
    		_id: "624467e61d5c030ceac2b053",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1434",
    			contractingOfficeAgencyName: "US GEOLOGICAL SURVEY",
    			fundingAgencyId: "1434",
    			fundingAgencyName: "US GEOLOGICAL SURVEY",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "(1) -185-L swim tunnel respirometer chamber & (1) -24 channel microplate system",
    			summaryOfProcurement: "one (1) new 185-L swim tunnel respirometer chamber for measuring oxygen and swimming speed of fish and bath and associated accessories, and one (1) new 24 channel microplate system for measuring oxygen of fish eggs, larvae, and invertebrates, and associated accessories.",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "Parts for a 185-L swim tunnel, specific to: a 185-L chamber, lid, and surrounding bath for the chamber. This includes a 88x25x25cm test section for the fish within a 185L chamber. The entire footprint of the system is 227x91cm. Features of the replacement items include having an additional lid to place specimen into the chamber. Collimator use for changing the flow. Ports for the oxygen and temperature probes.\nA microplate system would also be purchased. The 24-channel microplate would have 200 uL for each well that could be utilized for eggs and larvae and adds additional use and functionality to respirometry research. There would be one glass plate containing each of the wells that are gas-tight. A PCR film would be able to seal the plate. It would sit on a silicone pad as well as compression block. The system would come with MicroResp software to provide real-time readings and measurements for trials with specimens.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			]
    		},
    		created: "2022-03-30T14:23:34.693Z",
    		modified: "2022-04-21T17:29:40.591Z"
    	},
    	{
    		_id: "6246fd8e4c2f49fa21d13efa",
    		data: {
    			contractingOfficeAgencyId: "1434",
    			contractingOfficeAgencyName: "US GEOLOGICAL SURVEY",
    			fundingAgencyId: "1434",
    			fundingAgencyName: "US GEOLOGICAL SURVEY",
    			naics: {
    				NAICS_Code: 237130,
    				NAICS_Title: "Power and Communication Line and Related Structures Construction"
    			},
    			psc: {
    				pscId: 5472,
    				pscCode: "Y1BG",
    				pscName: "CONSTRUCTION OF ELECTRONIC AND COMMUNICATIONS FACILITIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Quantity 46 Panasonic HIT+ model N340 solar panels",
    			summaryOfProcurement: "The USGS’ Earthquake Science Center operates a network of seismic sensors, radio relays, and microwave radio communications facilities known as the Northern California Seismic Network, the purpose of which is to gather real-time data on seismic activity and, recently, provide advance notice of shaking to users via an earthquake early warning system (ShakeAlert® | Earthquake Early Warning). One of the microwave radio sites, at Geyser Peak, in Sonoma County, CA, requires the construction of an off-grid solar power system to support the upgraded communications equipment we recently installed.\n\nDOI has a IDIQ contract for construction at 17 sites. There is an existing task order for Geyser Peak, number 140G0318F0195.  The original plan was to connect to upgraded utility power, but that has proven prohibitively expensive.  Therefore, a pivot to an off-grid solar solution came into play. DOI will modify the task order to change from utility power to solar power, which is intended to be modification P00005, not yet issued pending approval of these foreign solar panels. ",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: "140G0318F0195"
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "DOI has a IDIQ contract (ING17PC00082) for construction at 17 sites. There is an existing task order for Geyser Peak, number 140G0318F0195.  The USGS’ Earthquake Science Center operates a network of seismic sensors, radio relays, and microwave radio communications facilities known as the Northern California Seismic Network. The purpose of which is to gather real-time data on seismic activity and, recently, provide advance notice of shaking to users via an earthquake early warning system (ShakeAlert® | Earthquake Early Warning). One of the microwave radio sites, at Geyser Peak, in Sonoma County, CA, requires the construction of an off-grid solar power system to support the upgraded communications equipment recently installed. The original plan was to connect to upgraded utility power, but that has proven prohibitively expensive.  Therefore, a pivot to an off-grid solar solution came into play. DOI will modify the task order 140G0318F0195 to change from utility power to solar power, which is intended to be modification P00005, not yet issued pending approval of this waiver.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "MY",
    						Three: "MYS",
    						Numeric: 458,
    						Name: "MALAYSIA"
    					}
    				}
    			],
    			solicitationId: ""
    		},
    		state: "submitted",
    		created: "2022-04-01T13:26:38.147Z",
    		modified: "2022-04-05T16:04:13.233Z"
    	},
    	{
    		_id: "6246eedb765b202ea7a8c5b3",
    		data: {
    			contractingOfficeAgencyId: "1434",
    			contractingOfficeAgencyName: "US GEOLOGICAL SURVEY",
    			fundingAgencyId: "1434",
    			fundingAgencyName: "US GEOLOGICAL SURVEY",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Portable X-ray fluorometer (p-XRF)",
    			summaryOfProcurement: "The USGS GMEGSC requires a portable X-ray fluorometer (p-XRF) instrument for geochemical measurements. The p-XRF instrument measures geochemical element concentrations in sediment and rock samples, in both lab and field settings, using non-destructive methods that preserve sample integrity.",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "This equipment is necessary to complete mission-critical data acquisition. This specific purchase request is to procure a replacement instrument for an aging p-XRF that is already owned by the GMEGSC. However, this instrument has reached end-of-life and repairs are no longer supported by its manufacturer. A failure to replace the XRF in a timely fashion will negatively impact the USGS POP3 Project by hampering a key set of mission-critical geochemical measurements that are used to characterize marine and lake sediment cores.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			]
    		},
    		state: "submitted",
    		created: "2022-04-01T12:23:55.775Z",
    		modified: "2022-04-02T15:57:18.614Z"
    	},
    	{
    		_id: "6246f4204c2f49fa21d13ed9",
    		data: {
    			contractingOfficeAgencyId: "1434",
    			contractingOfficeAgencyName: "US GEOLOGICAL SURVEY",
    			fundingAgencyId: "1434",
    			fundingAgencyName: "US GEOLOGICAL SURVEY",
    			naics: {
    				NAICS_Code: 541360,
    				NAICS_Title: "Geophysical Surveying and Mapping Services"
    			},
    			psc: {
    				pscId: 791,
    				pscCode: "6655",
    				pscName: "GEOPHYSICAL INSTRUMENTS"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "High-resolution bathymetric and topographic surveying Equipment",
    			summaryOfProcurement: "High-resolution bathymetric and topographic surveying is a vital part of a variety of ongoing and planned projects with the Central Midwest Water Science (CMWSC) of the USGS. The CMWSC is already in possession of the Norbit iWBMSh multibeam echosounder (MBES) system and is presently acquiring a second iWBMSh system to replace a less accurate iWBMSc system. The Norbit iLiDAR system would attach to the Norbit iWBMSh survey controller and work in conjunction with either of the MBES systems to collect high-resolution, high-accuracy bathymetric and topographic data over large swaths of the bed and banks of a water body when mounted to a marine vessel.",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "The Norbit iLiDAR system would attach to the Norbit iWBMSh survey controller and work in conjunction with either of the MBES systems to collect high-resolution, high-accuracy bathymetric and topographic data over large swaths of the bed and banks of a water body when mounted to a marine vessel. These data are used to measure changes in channel bed and bank morphology, evaluate bed and bank scour/erosion, develop base maps used for hydraulic modeling and other topographic projects, and characterize aquatic and other habitat. Continuity of data or interoperability with Army Corps of Engineers (USACE) navigation projects enable USGS and USACE to exchange bathymetric and topographic data for maps of lake bathymetry and studies of shore erosion.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			]
    		},
    		state: "submitted",
    		created: "2022-04-01T12:46:24.051Z",
    		modified: "2022-04-02T16:00:38.267Z"
    	},
    	{
    		_id: "6245db7a4c2f49fa21d13a5d",
    		data: {
    			contractingOfficeAgencyId: "97AS",
    			contractingOfficeAgencyName: "DEFENSE LOGISTICS AGENCY (DLA)",
    			fundingAgencyId: "1700",
    			fundingAgencyName: "DEPT OF THE NAVY",
    			naics: {
    				NAICS_Code: 315990,
    				NAICS_Title: "Apparel Accessories and Other Apparel Manufacturing"
    			},
    			psc: {
    				pscId: 965,
    				pscCode: "8415",
    				pscName: "CLOTHING, SPECIAL PURPOSE"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "MaxiFlex Cut Resistant Gloves",
    			summaryOfProcurement: "Purchase of MaxiFlex Cut Resistant Gloves in the following sizes:\nMedium\nLarge\nXLarge\nXXLarge. \nTotal number of pairs: 1440 pairs.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "N/A",
    			waiverRationaleSummary: "There does not exist a domestic source to procure the cut resistant gloves that have been approved for use on Norfolk Naval Shipyard.  ",
    			expectedMaximumDurationOfTheRequestedWaiver: "0 - 6 months",
    			requestStatus: "Submitted",
    			ombDetermination: "N/A",
    			solicitationId: "N4215820541547",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "LK",
    						Three: "LKA",
    						Numeric: 144,
    						Name: "SRI LANKA"
    					}
    				}
    			]
    		},
    		state: "submitted",
    		created: "2022-03-31T16:48:58.035Z",
    		modified: "2022-03-31T16:48:58.035Z"
    	},
    	{
    		_id: "624b32d6765b202ea7a8f202",
    		data: {
    			contractingOfficeAgencyId: "1434",
    			contractingOfficeAgencyName: "US GEOLOGICAL SURVEY",
    			fundingAgencyId: "1434",
    			fundingAgencyName: "US GEOLOGICAL SURVEY",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 799,
    				pscCode: "6680",
    				pscName: "LIQUID AND GAS FLOW, LIQUID LEVEL, AND MECHANICAL MOTION MEASURING INSTRUMENTS"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "UniPrep Sample Preparation System",
    			summaryOfProcurement: "There is an increased demand in the analysis of organic materials containing exchangeable hydrogen, and the Reston Stable Isotope Laboratory seeks to improve process-limiting steps of conventional methods of analysis of hydrogen and oxygen isotopic analysis. The current analysis method takes weeks per sample. By purchasing the UniPrep Sample Preparation System, the Government will be able to reduce the analysis time to hours.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "There is an increased demand in the analysis of organic materials containing exchangeable hydrogen, and the Reston Stable Isotope Laboratory seeks to improve process-limiting steps of conventional methods of analysis of hydrogen and oxygen isotopic analysis. The current analysis method takes weeks per sample. By purchasing the UniPrep Sample Preparation System, the Government will be able to reduce the analysis time to hours.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			]
    		},
    		state: "submitted",
    		created: "2022-04-04T18:03:02.918Z",
    		modified: "2022-04-14T15:12:18.336Z"
    	},
    	{
    		_id: "62503b57b7577ea4d2026081",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 333923,
    				NAICS_Title: "Overhead Traveling Crane, Hoist, and Monorail System Manufacturing "
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Elebia Autohook Evo20 Hook & Associated Components",
    			summaryOfProcurement: "This procurement is necessary to obtain a remote-controlled crane accessory known as an auto hook.  The company name brand required is Elebia. The Elebia auto hook is utilized to allow remote controlled latching and unlatching of assemblies manipulated by an overhead crane.  This remote-controlled operation is very advantages when maneuvering radioactive components.  Personnel are subjected to harmful radiation during the time when the component being transported by the crane are manually attached or removed from the crane hook.  By using the auto hook, this process is completed remotely, keeping operators at a safe distance thus protecting them from harmful radiation.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: "1333ND22PNB610129"
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "No domestic product has been identified that can meet the Government's requirements.  The combined synopsis/solicitation included FAR 52.225-1, Buy American Act Supplies.  The Offeror certified the end products being offered are not domestic end products and are a foreign end-product of Spain.  ",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "ES",
    						Three: "ESP",
    						Numeric: 724,
    						Name: "SPAIN"
    					}
    				}
    			],
    			solicitationId: "1333ND22QNB610088"
    		},
    		state: "submitted",
    		created: "2022-04-08T13:40:39.727Z",
    		modified: "2022-04-13T19:57:01.260Z"
    	},
    	{
    		_id: "624ed613db68fcb5affece60",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "JASCO J-1500 Accessory ",
    			summaryOfProcurement: "one (1) diffuse reflectance circular dichroism accessory ",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: "1333ND22PNB680132"
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "No Domestic product has been identified that can meet the Governments requirements. The SF1449 solicitation included FAR 52.225-1, Buy American--Supplies. Japan does not fall under any of these trade agreements nor did the offeror certify compliance. ",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "JP",
    						Three: "JPN",
    						Numeric: 392,
    						Name: "JAPAN"
    					}
    				}
    			],
    			solicitationId: "1333ND22QNB680083"
    		},
    		state: "submitted",
    		created: "2022-04-07T12:16:19.900Z",
    		modified: "2022-04-08T13:20:27.054Z"
    	},
    	{
    		_id: "624f35acdb68fcb5affed372",
    		data: {
    			contractingOfficeAgencyId: "8900",
    			contractingOfficeAgencyName: "ENERGY, DEPARTMENT OF",
    			fundingAgencyId: "8900",
    			fundingAgencyName: "ENERGY, DEPARTMENT OF",
    			naics: {
    				NAICS_Code: 335311,
    				NAICS_Title: "Power, Distribution, and Specialty Transformer Manufacturing "
    			},
    			psc: {
    				pscId: 722,
    				pscCode: "6120",
    				pscName: "TRANSFORMERS: DISTRIBUTION AND POWER STATION"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Direct Replacement of Single Core Shunt Reactors manufactured by Trench Group ",
    			summaryOfProcurement: "Purchase of two replacement air core reactor units manufactured by Trench Group in Canada. The units are part of a three reactor unit currently in place. This requirement is brand name specific. The replacement reactors must be a matching set of Trench Core Reactors to ensure the proper fit, balance, load and performance to maintain the power grid. The Trench Core Reactor is a patented design with a unique mounting scheme and is the only one that will fit and function properly with the current existing reactor. Other core reactors are made in America, but none have the design and system compatibility to work with the existing system.  Were this procurement not designated as a small business set-aside, a waiver would not be required because the Trade Agreements Act would apply and the procurement could move forward since the items are manufactured in Canada. However, WAPA and the SBA do not want to remove this from the SBA Program. ",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "A waiver is requested since it has been determined that only a reactor manufactured by Trench will meet the requirement for WAPA since the equipment that it will be connected to is a proprietary system.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			]
    		},
    		state: "submitted",
    		created: "2022-04-07T19:04:12.404Z",
    		modified: "2022-04-08T13:22:19.637Z"
    	},
    	{
    		_id: "625048ccb7577ea4d20261ff",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Neutron Guide Elements",
    			summaryOfProcurement: "The contents of this delivery order are three identical guides. The guides will be standard except for the requirement to minimize the thickness of the bottom plate and add blind tapped holes or features on the sides to allow support and alignment from the top and sides to leave the space underneath the guide free. The substrate material for all guides in this order will be aluminum.  These guides must be manufactured to the same tolerances and surface finishes/waviness as any standard neutron guide.  Because of this, they can only be acquired from a company with the expertise and equipment to design and manufacture neutron guides.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: "1333ND22PNB680136"
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "The manufacture of neutron guides is a very specialized industry.  It requires very specialized equipment and coating techniques (mostly proprietary), special knowledge and experience and access to a neutron scattering facility for quality control and development of next-generation coatings and neutron optics.  Couple this with a very narrow market for the product and what results is only a few sources of neutron guides worldwide.  Mobilization into and out of the neutron guide business is highly unlikely.  There are no U.S. OEM sources of neutron guides.  The only known sources of neutron guides available to the small U.S. market are in Europe and are located near neutron scattering facilities similar to the NCNR.  Since the advent of cold neutron research at the NCNR in the 1980’s, guides have been procured from four sources.  One of these, CILAS, has ceased production of neutron guides.  The other three are S-DH in Heidelburg, Germany, Mirrotron in Budapest, Hungary, and Swiss Neutronics in Switzerland.  ",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "DE",
    						Three: "DEU",
    						Numeric: 276,
    						Name: "GERMANY"
    					}
    				}
    			],
    			solicitationId: "1333ND22QNB680035"
    		},
    		state: "submitted",
    		created: "2022-04-08T14:38:04.783Z",
    		modified: "2022-04-13T20:07:08.053Z"
    	},
    	{
    		_id: "62546e05b7577ea4d2029db9",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 334515,
    				NAICS_Title: "Instrument Manufacturing for Measuring and Testing Electricity and Electrical Signals"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Hybrid Chamber RF Absorber Kit",
    			summaryOfProcurement: "Hybrid Chamber RF Absorber Kit. The absorbers must be high performance reflectivity less than 40 dB at normal incidence, magnetically backed for easy installation in existing NIST chambers. Must be identical as previously procured so the chambers have the exact same RF propagation characteristics.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: "1333ND22PNB6870090"
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "Based on the findings stated above, I hereby determine that an article, material, or supply that meets NIST’s requirements is not mined, produced, or manufactured in the United States in sufficient and reasonably available commercial quantities of a satisfactory quality. \n\nAuthority is hereby granted to procure the above-described items that are manufactured in Sweden at a total price of $19,930, including shipping costs to destination. \n\n",
    			expectedMaximumDurationOfTheRequestedWaiver: "0 - 6 months",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "SE",
    						Three: "SWE",
    						Numeric: 752,
    						Name: "SWEDEN"
    					}
    				}
    			],
    			solicitationId: "NB672020-22-00758"
    		},
    		state: "submitted",
    		created: "2022-04-11T18:05:57.305Z",
    		modified: "2022-04-21T18:16:11.992Z"
    	},
    	{
    		_id: "62549fa9b7577ea4d2029e49",
    		data: {
    			contractingOfficeAgencyId: "12H2",
    			contractingOfficeAgencyName: "AGRICULTURAL RESEARCH SERVICE",
    			fundingAgencyId: "12H2",
    			fundingAgencyName: "AGRICULTURAL RESEARCH SERVICE",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Hydrocyclone Test Rig",
    			summaryOfProcurement: "An  electrically powered hydrocyclone test rig is required .  The equipment must be suitable for testing hydrocyclones with internal diameter of 2 inches/50 mm and smaller, a maximum of 20-50L capacity, maximum footprint of 40”L x 25”W and must deliver a slurry to a hydrocyclone at a controllable range of inlet pressures and allows for collection of  samples from overflow and underflow streams.  The  equipment will be used to research the processing of waste ice cream with hydrocyclones of various dimensions.",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "An internet search was performed for items potentially matching the requirements were sought by searches using the following terms, in a variety of combinations: cyclone, hydrocyclone, test rig, test system, pilot scale, laboratory, evaluation, equipment, processing. One candidate item was identified, but further research showed that only the Gravity Cyclones, Cyclone Test System & accessories needed will meet the government requirements.\n\nBased on the findings presented above, no domestic companies manufacture this product within the US that meets the requirement. It is only available through a Gravity Mining Limited, Cardrew Trade Park Redruth, TR15 1SW, Great Britain",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "GB",
    						Three: "GBR",
    						Numeric: 826,
    						Name: "UNITED KINGDOM"
    					}
    				}
    			],
    			solicitationId: "12305B22-1054057"
    		},
    		state: "submitted",
    		created: "2022-04-11T21:37:45.131Z",
    		modified: "2022-04-13T20:12:47.962Z"
    	},
    	{
    		_id: "62585bbb5a9e92e261b0fdc4",
    		data: {
    			contractingOfficeAgencyId: "1434",
    			contractingOfficeAgencyName: "US GEOLOGICAL SURVEY",
    			fundingAgencyId: "1434",
    			fundingAgencyName: "US GEOLOGICAL SURVEY",
    			naics: {
    				NAICS_Code: 334513,
    				NAICS_Title: "Instruments and Related Products Manufacturing for Measuring, Displaying, and Controlling Industrial Process Variables "
    			},
    			psc: {
    				pscId: 791,
    				pscCode: "6655",
    				pscName: "GEOPHYSICAL INSTRUMENTS"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Six (6) 5-Beam Acoustic Doppler Profiler measuring",
    			summaryOfProcurement: "Acoustic Doppler Current Profilers (ADCPs) are the standard in current measurement, replacing older, more man hour intensive technologies. Current measurements throughout the water column are an integral part of this field program, and in\nparticular, the ability to take multiple, precise measurement of the currents within a single meter with high frequency is necessary to resolve wave velocities and turbulence in the vicinity of artificial reef structures. A 1 MHz unit is required for the water depth and desired depth resolution at the proposed deployment site. The size and shape of the instrument itself is important for mounting considerations and can significantly affect the measurements of other instruments and must be considered. High resolution measurements of acoustic backscatter and vertical velocity are critical to studies of turbulence and sediment transport. Nortek is the only manufacturer of the 5-Beam Acoustic Doppler Profiler measuring instruments with the required salient characteristics.",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "USGS, Pacific Coastal and Marine Science Center, Santa Cruz, CA will not be able to meet their mission goal for a Verification and Validation study of artificial reefs. ",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			]
    		},
    		state: "submitted",
    		created: "2022-04-14T17:36:59.457Z",
    		modified: "2022-04-21T18:57:54.547Z"
    	},
    	{
    		_id: "625ec2ac5a9e92e261b120a2",
    		data: {
    			contractingOfficeAgencyId: "1434",
    			contractingOfficeAgencyName: "US GEOLOGICAL SURVEY",
    			fundingAgencyId: "1434",
    			fundingAgencyName: "US GEOLOGICAL SURVEY",
    			naics: {
    				NAICS_Code: 326140,
    				NAICS_Title: "Polystyrene Foam Product Manufacturing"
    			},
    			psc: {
    				pscId: 938,
    				pscCode: "8115",
    				pscName: "BOXES, CARTONS, AND CRATES"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Custom Ice Core Boxes",
    			summaryOfProcurement: "The need for custom made and sized Ice Core boxes are critical for the safe and reliable transportation of irreplaceable ice cores and samples from Antarctica and Greenland to the USGS managed National Science Foundation Ice Core Facility in Denver, Colorado. A diminishing and degrading inventory of previously manufactured ice core transport boxes combined with unavailable production options drove our recent search. Redesign and modifications to the previous design also contributed to difficulty in production. A diminishing and degrading inventory of previously manufactured ice core transport boxes combined with unavailable production options drove our recent search. Redesign and modifications to the previous design also contributed to difficulty in production. Redesign needs included safer material handling capability, a slightly slimmer design to maximize shipping space and more robust insulation for durability in field handling and cold temperature holding considerations.\n \nThe Buyer/CO conducted market research through a sources sought notice posted on December 17, 2021 with responses due December 28, 2021. The CO received no responses, resulting from the sources sought. RFQ 140G0222Q0025 was posted on SAM.gov February 1, 2022 through March 3, 2022. Amendment 0001 was issued on February 25, 2022 answering questions that were submitted by potential offerors. Amendment 0001 also extended the RFQ close date to March 10, 2022. One (1) quotation from Skufa GmbH was received in response to the RFQ. Skufa GmbH is located in Alveslohe, Germany.",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "Pre-Award - RFQ 140G0222Q0025 received one quote. The USGS Technical POC found the quote from Germany vendor as technically acceptable.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			]
    		},
    		state: "submitted",
    		created: "2022-04-19T14:09:48.479Z",
    		modified: "2022-04-29T17:09:08.933Z"
    	},
    	{
    		_id: "6255c793563fcbe16f2fdab3",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 334513,
    				NAICS_Title: "Instruments and Related Products Manufacturing for Measuring, Displaying, and Controlling Industrial Process Variables "
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Two Frequency Tunable Lasers",
    			summaryOfProcurement: "The National Institute of Standards and Technology (NIST), Physical Measurement Laboratory (PML), Quantum Electromagnetics Division (QED) has a mission to provide the metrological foundation for emerging electronic, magnetic, and photonic technologies by developing high-precision measurement devices, systems, standards, and methodologies and applying them to address national needs. The QED is developing new measurement capability to support magnetic random-access memories involving novel spin-based technologies. The NIST Heterodyne Magneto-Optical Microwave Microscope (HMOMM) relies on ultra-low noise, single frequency, tunable, continuous-wave lasers to perform the heterodyne mixing. The current frequency tunable lasers are nearing end-of-life and must be replaced with two new lasers that perform with the same or better specifications.",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: "1333ND22PNB680135"
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "Based on the findings stated above, there are no vendors who provide a domestic end product for the specified lasers. Therefore, I have determined that the required end product is not mined, produced, or manufactured in the United States in sufficient and reasonably available commercial quantities of satisfactory quality that meet all the NIST requirements. This results in determining that the required two new lasers shall be treated as a domestic article for this procurement.\nAuthority is hereby granted to procure the above-described foreign end product at a total quoted price of $147,282.00, inclusive of transportation costs to destination.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Between 6 months and 1 year",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "GB",
    						Three: "GBR",
    						Numeric: 826,
    						Name: "UNITED KINGDOM"
    					}
    				}
    			],
    			solicitationId: "NB647040-22-00488"
    		},
    		state: "submitted",
    		created: "2022-04-12T18:40:19.245Z",
    		modified: "2022-04-21T17:53:22.195Z"
    	},
    	{
    		_id: "62718845a285bcc165959f83",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 334515,
    				NAICS_Title: "Instrument Manufacturing for Measuring and Testing Electricity and Electrical Signals"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "High-Bandwidth Digitizer Card",
    			summaryOfProcurement: "a high-bandwidth digitizer card.  The high-bandwidth digitizer card will be used to develop a new photonic readout method and will be used for the development of a chip-scale photonic temperature and pressure sensors and standards.\n",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: "1333ND22PNB680174"
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "No Domestic product has been identified that can meet the Governments requirements\n",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "SE",
    						Three: "SWE",
    						Numeric: 752,
    						Name: "SWEDEN"
    					}
    				}
    			],
    			solicitationId: "1333ND22QNB680182"
    		},
    		state: "submitted",
    		created: "2022-05-03T19:53:41.900Z",
    		modified: "2022-05-05T16:09:02.455Z"
    	},
    	{
    		_id: "6270156b554aebc42b7426cf",
    		data: {
    			contractingOfficeAgencyId: "7524",
    			contractingOfficeAgencyName: "FOOD AND DRUG ADMINISTRATION",
    			fundingAgencyId: "7524",
    			fundingAgencyName: "FOOD AND DRUG ADMINISTRATION",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Tissue Control Unit with 4 (1-year Post-Warranty Maintenance Option periods)",
    			summaryOfProcurement: "Background: The Food and Drug Administration (FDA)/National Center for Toxicological Research (NCTR)/Division of Genetic and Molecular Toxicology (DGMT) has a need for a microphysiological system (mps) control unit capable of operating organ chips for simultaneous culture of multiple tissues among other application which will be described in detail in the required minimal technical specifications. The mps control unit will support several ongoing and future projects, including investigating the impact on target tissues of zika virus (zikv) sexual transmission from the testes (e07775), zikv transmission through the placental barrier (e03003), drug transport across the placental barrier (e7728 and c22003) and development artificial lung and liver organ to study biomarkers of corona virus infection (c21042).  The systems currently in use in DGMT consist of two tissuse humimic control units with each capable of operating 4 mps organ chips.",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: "75F40122Q00019_1251139"
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "Single Definitive Contract that will involve a Single Delivery\nThis item is a commercially available off-the-shelf (COTS) item(s) as is defined in FAR 2.101.\nNo domestically manufactured or eligible end products are capable of satisfying the requirement that has been identified.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Between 3 and 5 years",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "DE",
    						Three: "DEU",
    						Numeric: 276,
    						Name: "GERMANY"
    					}
    				}
    			],
    			solicitationId: "75F40122Q00019_1251139"
    		},
    		state: "submitted",
    		created: "2022-05-02T17:31:23.743Z",
    		modified: "2022-05-12T13:01:56.261Z"
    	},
    	{
    		_id: "626ff05ca285bcc165959381",
    		data: {
    			contractingOfficeAgencyId: "7529",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTES OF HEALTH",
    			fundingAgencyId: "7529",
    			fundingAgencyName: "NATIONAL INSTITUTES OF HEALTH",
    			naics: {
    				NAICS_Code: 333922,
    				NAICS_Title: "Conveyor and Conveying Equipment Manufacturing"
    			},
    			psc: {
    				pscId: 442,
    				pscCode: "3910",
    				pscName: "CONVEYORS"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Lab2Lab™ Transport Tubes",
    			summaryOfProcurement: "The National Institute on Drug Abuse (NIDA), Office of Acquisition (OA), on the behalf of the National Center for Advancing Translational Sciences (NCATS), has a need to acquire an additional quantity of fifteen (15) reels (100m each) of transport pipe via a\nmodification under Purchase Order number 75N95021P00525 which was awarded to acquire an automated pneumatic tube sample delivery system, designed, and customized for the NCATS Next Generation Translational Science Laboratory. The need for this\nsystem was in response to the A Specialized Platform for Innovative Research Exploration (ASPIRE) Initiative, which NCATS seeks to accelerate preclinical drug discovery by integrating automated synthetic chemistry, high-throughput biology, and information technologies to help scientists study unexplored biologically active chemical space. This additional tubing is necessary to ensure that there is sufficient quality controlled, inspected transport tubing for complete installation of the transport system.",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "The statute and regulation upon which this D&F is based is 41 U.S.C. 8302 and Federal Acquisition Regulation (FAR) 25.103(b). Based on the findings detailed in the D&F, the additional transport tubing is not mined, produced, or manufactured in the United States in sufficient and reasonably available commercial quantities and of a satisfactory quality. Therefore, it is hereby determined, consistent with FAR 25.103(b), that these items are nonavailable.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "GB",
    						Three: "GBR",
    						Numeric: 826,
    						Name: "UNITED KINGDOM"
    					}
    				}
    			],
    			solicitationId: "75N95021R00033"
    		},
    		state: "submitted",
    		created: "2022-05-02T14:53:16.893Z",
    		modified: "2022-05-06T16:57:16.205Z"
    	},
    	{
    		_id: "626ab744554aebc42b74051f",
    		data: {
    			contractingOfficeAgencyId: "7529",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTES OF HEALTH",
    			fundingAgencyId: "7529",
    			fundingAgencyName: "NATIONAL INSTITUTES OF HEALTH",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 752,
    				pscCode: "6505",
    				pscName: "DRUGS AND BIOLOGICALS"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "10X Multiple kits for Genomics 5’ GEMS library preparation",
    			summaryOfProcurement: "The purpose of this requirement is to provide the National Institute of Neurological Disorders and Stroke (NINDS) a\npart of the National Institutes of Health (NIH), with chromium Next GEM single cell 5' GEM, library & gel bead kit v1.1\nand associated supplemental kits that are required to unveil transcriptional changes in patients of undiagnosed\ndiseases with neurologic presentations, as well as expansions in the T and B cell receptor repertoires associated\nwith immune involvement of a disease.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "The outcome of this market research determined that 10X Genomics offers the only reasonable product for the purpose of preparing single cell RNA sequencing library preparation kits with highly efficient cell recovery unmatched in the industry. There are no domestically manufactured items produced that can meet the same need of the 10X Genomics Chromium Next GEM 5’ v1.1 single cell RNA sequencing library preparation kits.\n\nBased on the findings , 10X Genomics Chromium Next GEM Single Cell 5’ Library Kits v1.1 are not mined, produced, or manufactured in the United States in sufficient and reasonably available commercial quantities and of a satisfactory quality. Therefore, it is hereby determined, consistent with FAR 25.103(b), that these items are nonavailable.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Between 6 months and 1 year",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			]
    		},
    		state: "submitted",
    		created: "2022-04-28T15:48:20.067Z",
    		modified: "2022-05-02T14:24:10.972Z"
    	},
    	{
    		_id: "626b17b9554aebc42b7407a3",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 334513,
    				NAICS_Title: "Instruments and Related Products Manufacturing for Measuring, Displaying, and Controlling Industrial Process Variables "
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Swabian Time tagging unit for single photon counting",
    			summaryOfProcurement: "The time tagging unit will be used for single photon counting and  will assist with NIST’s research of developing a measurement test suite for quantum network component and protocol testing, verification, and characterization. The test suite will be implemented on the NIST campus along with a fiber network dedicated to quantum optical signal transfer between various quantum network nodes. An extensive software and data acquisition library has been written by NIST researchers from conducting experiments using a Swabian 20 time tagger, which is required to replicate previous results and record accurate and consistent measurements. ",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: "1333ND22PNB770166"
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "The required time tagging unit is not mined, produced, or manufactured in the United States in sufficient and reasonably available commercial quantities, of a satisfactory quality. Therefore, the required time tagging unit shall be treated as a domestic article for this procurement. Further, authority is hereby granted to procure the above described item of foreign origin (Germany) at a total cost of $10,990, inclusive of transportation costs to destination.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "DE",
    						Three: "DEU",
    						Numeric: 276,
    						Name: "GERMANY"
    					}
    				}
    			],
    			solicitationId: "AMD-TC-22-00904"
    		},
    		state: "submitted",
    		created: "2022-04-28T22:39:53.112Z",
    		modified: "2022-05-02T14:23:41.470Z"
    	},
    	{
    		_id: "626ad6f5c24cde4e8b4492ad",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 325199,
    				NAICS_Title: "All Other Basic Organic Chemical Manufacturing"
    			},
    			psc: {
    				pscId: 817,
    				pscCode: "68",
    				pscName: "CHEMICALS AND CHEMICAL PRODUCTS"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Natural Chemical Products",
    			summaryOfProcurement: "This procurement was for 1900 Natural Products in which NIST has purchased in the past for use with the NIST/NIH/EPA Mass Spectral Library and Tandem Mass Spectral Library.  Prior procurement's identified 2 small business sources for products which would meet the needs of the Government.  This was posted to SAM.gov for a period of 15 days which resulted in a single quotation being received.  ",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: "NB645040-22-00745"
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "The requirement was solicited on SAM.gov, a single quotation was received which was determined to meet the minimum requirements.  This single quotation offered products which are manufactured in Germany.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "DE",
    						Three: "DEU",
    						Numeric: 276,
    						Name: "GERMANY"
    					}
    				}
    			],
    			solicitationId: "1333ND22QNB640127  "
    		},
    		state: "submitted",
    		created: "2022-04-28T18:03:33.313Z",
    		modified: "2022-05-02T14:17:54.815Z"
    	},
    	{
    		_id: "626fe310c24cde4e8b44b064",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Two microwave sources",
    			summaryOfProcurement: "Market research performed by the customer and the acquisition office identified multiple small business resellers for equipment which would meet the minimum requirement.   This was solicited as a 100% small business set aside on SAM.gov for a period of 15 days.  This resulted in 13 quotations being received and evaluated for technical acceptability.  12 of the 13 were determined to be acceptable per the requirements posted to the solicitation and all products were manufactured overseas.  No US manufactured products were determined to be technically acceptable.  ",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "The NIST Chemical Sciences Division, Optical Measurements Group develops ultrasensitive spectroscopic methods for measurements of trace gases. These measurements require high bandwidth, rapid switching microwave sources to drive electro-optic phase modulators to further the science being performed. To further the lab and NIST’s mission, two microwave-frequency signal generators are needed.\n\nRecent market research identified multiple small and other than small business sources for equipment which would meet the required minimum specifications. A solicitation was thereafter posted on SAM.gov as a total small business set-aside. NIST thereafter received a large number of quotations. Only foreign-manufactured products were found to be technically acceptable and at a fair and reasonable price.\n\nThe result of the selection process is an award to a reseller of Berkeley Nucleonics Corporation, and the required products are manufactured in Switzerland.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "CH",
    						Three: "CHE",
    						Numeric: 756,
    						Name: "SWITZERLAND"
    					}
    				}
    			],
    			solicitationId: "1333ND22QNB640120 "
    		},
    		state: "submitted",
    		created: "2022-05-02T13:56:32.587Z",
    		modified: "2022-05-12T12:50:09.953Z"
    	},
    	{
    		_id: "62699ba9563fcbe16f303e8b",
    		data: {
    			contractingOfficeAgencyId: "7524",
    			contractingOfficeAgencyName: "FOOD AND DRUG ADMINISTRATION",
    			fundingAgencyId: "7524",
    			fundingAgencyName: "FOOD AND DRUG ADMINISTRATION",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "STA Compact Max Hemostasis System plus four years of post warranty maintenance",
    			summaryOfProcurement: "The U.S. Food and Drug Administration’s (FDA), Center for Biologics Evaluation and Research, Division of Biological Standards and Quality Control (DBSQC) serves as a Standards Preparation and Testing laboratory for CBER.  Samples deposited by Sponsors (Industry) for licensing and lot release approvals are tested in DBSQC/OCBQ/ CBER.  DBSQC requires purchase of a STA Compact Max Hemostasis system for Blood Products testing which includes installation, training and method verification, as well as four (4) 1-year options for post-warranty maintenance on the instrument.",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: "75F40122P00041"
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "Based on the findings, the aforementioned hemostasis system is not produced or manufactured in the United States in sufficient and/or reasonably available commercial quantities; therefore, it is hereby determined, consistent with FAR 25.103(b), that these items are nonavailable.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "FR",
    						Three: "FRA",
    						Numeric: 250,
    						Name: "FRANCE"
    					}
    				}
    			],
    			solicitationId: "75F40122Q1251242"
    		},
    		state: "submitted",
    		created: "2022-04-27T19:38:17.377Z",
    		modified: "2022-04-29T17:58:34.500Z"
    	},
    	{
    		_id: "62682c82563fcbe16f303bb4",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Pulsed Diode Laser System with Software",
    			summaryOfProcurement: "The purpose of this acquisition is to procure one (1) Picoquant high-pulse energy pulsed-diode laser system with Picoquant Sepia II Software. ",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: "1333ND22PNB770164"
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "The NIST ITL currently owns and operates an existing Picoquant laser and requires a compatible second laser for further photon entanglement research.  Picoquant equipment and software are proprietary, and no other source can provide products that will meet NIST’s requirement that the required second laser be compatible with the existing Picoquant laser. \n\n",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "DE",
    						Three: "DEU",
    						Numeric: 276,
    						Name: "GERMANY"
    					}
    				}
    			],
    			solicitationId: "NIST-NOI-22-7701173"
    		},
    		state: "submitted",
    		created: "2022-04-26T17:31:46.272Z",
    		modified: "2022-04-29T17:40:51.188Z"
    	},
    	{
    		_id: "626bf641c24cde4e8b449a94",
    		data: {
    			contractingOfficeAgencyId: "4740",
    			contractingOfficeAgencyName: "PUBLIC BUILDINGS SERVICE",
    			fundingAgencyId: "4740",
    			fundingAgencyName: "PUBLIC BUILDINGS SERVICE",
    			naics: {
    				NAICS_Code: 221118,
    				NAICS_Title: "Other Electric Power Generation"
    			},
    			psc: {
    				pscId: 4921,
    				pscCode: "S112",
    				pscName: "UTILITIES- ELECTRIC"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Energy Efficient Lighting Upgrades",
    			summaryOfProcurement: "GSA Region 7 UESC, Oklahoma has a requirement to install energy efficient Lighting Upgrades in Five (5) Federal Buildings and/or Courthouses located in Oklahoma and surrounding areas. As a result, the prime and subcontractor for this UESC, Oklahoma Gas & Energy (OG&E) and Ameresco are requesting a waiver for procurement of the additional LED screw-in light bulbs IAW incorporated FAR Clause 52.225-11, Buy American Materials under Trade Agreement.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "The TCP LED screw-in light bulbs are not mined, produced, or manufactured in the United States in sufficient and reasonably available commercial quantities of a satisfactory quality. Substitutes are not available domestically. Recent industry acquisitions, mergers and\nconsolidations have moved the manufacturing of these lamps to non-TAA countries. The contractor conducted thorough research and exhausted every option to find compliant BAA LED lamps to no avail. ",
    			expectedMaximumDurationOfTheRequestedWaiver: "Between 1 and 2 years",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "CN",
    						Three: "CHN",
    						Numeric: 156,
    						Name: "CHINA"
    					}
    				}
    			],
    			solicitationId: ""
    		},
    		state: "submitted",
    		created: "2022-04-29T14:29:21.232Z",
    		modified: "2022-05-06T19:30:16.311Z"
    	},
    	{
    		_id: "626aabe6554aebc42b740503",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 334310,
    				NAICS_Title: "Audio and Video Equipment Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Purchase of a video recording system to aid in recording tests conducted with radiation detection equipment.",
    			summaryOfProcurement: "Purchase of a video recording system to aid in recording tests conducted with radiation detection equipment.\n",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: "1333ND22PNB680159"
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "No Domestic product has been identified that can meet the Governments requirements\n",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "PL",
    						Three: "POL",
    						Numeric: 616,
    						Name: "POLAND"
    					}
    				}
    			],
    			solicitationId: "1333ND22QNB680138"
    		},
    		state: "submitted",
    		created: "2022-04-28T14:59:50.041Z",
    		modified: "2022-05-05T16:06:04.896Z"
    	},
    	{
    		_id: "62068894baa79dbcd0a33126",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "7529",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTES OF HEALTH",
    			fundingAgencyId: "7529",
    			fundingAgencyName: "TEST NATIONAL INSTITUTES OF HEALTH",
    			naics: {
    				NAICS_Code: 334510,
    				NAICS_Title: "Electromedical and Electrotherapeutic Apparatus Manufacturing"
    			},
    			psc: {
    				pscId: 774,
    				pscCode: "66",
    				pscName: "INSTRUMENTS AND LABORATORY EQPT"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "32 and 64-Contact Linear Arrays",
    			summaryOfProcurement: "The Laboratory of Neuropsychology at the National Institute of Mental Health (NIMH) investigates higher brain functions such as learning, memory, and reward-related decision making. These studies require electrodes to explore deep structures in the nonhuman primate brain to evaluate the relationship between these structures and primate behavior.  \n\nThe exploration of brain regions known to contribute to reward-related behaviors requires different electrode designs depending on the exact region to be studied. The specified purchase is for electrodes that have been designed and tested for reaching deep structures in nonhuman primate, like the amygdala, but still suitable for superficial cortical recordings in nonhuman primates. The specified electrodes are required for three ongoing studies of reward-related circuitry, an essential component of the NIMH mission to understand and develop treatments for behavioral disorders.\n\nPurpose\nThe purpose of this acquisition is to acquire Two (2) of Plexon Inc 32-contact Electrodes and Two (2) of Plexon Inc 64-contact Electrodes or Equal.\n",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "In accordance with FAR 25.103(b) Nonavailability all of the following conditions have been met: \n (i) The acquisition was conducted through use of full and open competition.\n (ii) The acquisition was synopsized in accordance with 5.201.\n(iii) No offer for a domestic end product was received. \n",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "HU",
    						Three: "HUN",
    						Numeric: 348,
    						Name: "HUNGARY"
    					}
    				}
    			],
    			solicitationId: "NIMH-22-001108"
    		},
    		created: "2022-02-11T16:02:28.822Z",
    		modified: "2022-02-15T13:55:21.138Z"
    	},
    	{
    		_id: "6206b88bbaa79dbcd0a33213",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1330",
    			contractingOfficeAgencyName: "NATIONAL OCEANIC AND ATMOSPHERIC ADMINISTRATION",
    			fundingAgencyId: "1330",
    			fundingAgencyName: "NATIONAL OCEANIC AND ATMOSPHERIC ADMINISTRATION",
    			naics: {
    				NAICS_Code: 334511,
    				NAICS_Title: "Search, Detection, Navigation, Guidance, Aeronautical, and Nautical System and Instrument Manufacturing "
    			},
    			psc: {
    				pscId: 475,
    				pscCode: "4240",
    				pscName: "SAFETY AND RESCUE EQUIPMENT"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "SPECIALIZED DIVER TRACKING SYSTEM",
    			summaryOfProcurement: "Specialized diver tracking system that tracks and records the real time positions of multiple (maximum of 6) divers and provides a diver-held electronic device used to record positions and other data while diving. Includes three buoys that provide GPS positioning; Acoustic receiver interrogator, Wi-Fi and Bluetooth connectivity;  Six (6) diver units that are attached on the air tank and communicate with the buoys via an ultrasound acoustic pinger which can triangulate the position of the diver based on time delays between the diver unit and the three buoys; An underwater tablet that can communicate directly with the diver unit via wireless Bluetooth, Wi-Fi or inductive data transfer; Underwater housing for the tablet should allow full access to the tablet for data entry;  lightweight buoys and easy to deploy; system is not bulky; system shall not include a float that is attached to the unit dragged around by the diver for GPS navigation that would be subject to kelp entanglement;  All diver-held equipment must be durable and capable of operating at depths of at least 100 meters ; System capable of tracking divers that are separated by a distance of one kilometer or less with a reporting of diver positions with an absolute accuracy of at least 2.5 meters and a relative accuracy of at least 0.5 meters. Depth data should have an accuracy of 0.1 meters\n",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "There are no suitable diver tracking systems made in the US that meet the governments requirements.  This is a highly specialized unit that can track multiple divers at once as well as feeds back exact GPS units to the main ship while divers are up to 100meters deep.",
    			expectedMaximumDurationOfTheRequestedWaiver: "0 - 6 months",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "FI",
    						Three: "FIN",
    						Numeric: 246,
    						Name: "FINLAND"
    					}
    				}
    			],
    			solicitationId: "NFFSH300-22-00293"
    		},
    		created: "2022-02-11T19:27:07.033Z",
    		modified: "2022-02-15T14:13:52.802Z"
    	},
    	{
    		_id: "620d82f5a407c4974ebf34c6",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "8000",
    			contractingOfficeAgencyName: "NATIONAL AERONAUTICS AND SPACE ADMINISTRATION",
    			fundingAgencyId: "8000",
    			fundingAgencyName: "NATIONAL AERONAUTICS AND SPACE ADMINISTRATION",
    			naics: {
    				NAICS_Code: 236210,
    				NAICS_Title: "Industrial Building Construction"
    			},
    			psc: {
    				pscId: 5721,
    				pscCode: "Z2AZ",
    				pscName: "REPAIR OR ALTERATION OF OTHER ADMINISTRATIVE FACILITIES AND SERVICE BUILDINGS"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Utility Energy Service Contract (UESC)",
    			summaryOfProcurement: "The Task Order (TO) incorporates UESC Phase 1 Engineering and Design Implementation; and Operation and Maintenance and includes the Feasibility Study. One part of this project replaces existing florescent T5 lamps with new LED T5 lamps.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: "80KSC021F0111"
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "In accordance with Federal Acquisition Regulation (FAR) 25.103, the Contracting Officer (CO) may acquire the foreign end product identified herein without regard to the restrictions of the Buy American Act, under the authority of the Nonavailability exception (b)(2)(i).  This authorization is based upon the determination that the articles, materials, or supplies to be procured are not mined, produced, or manufactured in the United States (U.S.) in sufficient and reasonably available commercial quantities of a satisfactory quality.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "CN",
    						Three: "CHN",
    						Numeric: 156,
    						Name: "CHINA"
    					}
    				}
    			],
    			solicitationId: "N/A"
    		},
    		created: "2022-02-16T23:04:21.629Z",
    		modified: "2022-02-17T12:47:14.895Z"
    	},
    	{
    		_id: "620fcc82baa79dbcd0a36752",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Frequency Doubled Ti:sapphire Laser System",
    			summaryOfProcurement: "One (1) Pump laser; One (1) Ti-Sappire Laser; One (1) Doubling Cavity",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: "1333ND22PNB680081 "
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "No Domestic product has been identified that can meet the Governments requirements",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "GB",
    						Three: "GBR",
    						Numeric: 826,
    						Name: "UNITED KINGDOM"
    					}
    				}
    			],
    			solicitationId: "1333ND22QNB680051"
    		},
    		created: "2022-02-18T16:42:42.926Z",
    		modified: "2022-02-25T18:51:36.741Z"
    	},
    	{
    		_id: "62167eadd85efd9c8bbab09e",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "12K3",
    			contractingOfficeAgencyName: "ANIMAL AND PLANT HEALTH INSPECTION SERVICE",
    			fundingAgencyId: "12K3",
    			fundingAgencyName: "ANIMAL AND PLANT HEALTH INSPECTION SERVICE",
    			naics: {
    				NAICS_Code: 334511,
    				NAICS_Title: "Search, Detection, Navigation, Guidance, Aeronautical, and Nautical System and Instrument Manufacturing "
    			},
    			psc: {
    				pscId: 750,
    				pscCode: "6350",
    				pscName: "MISCELLANEOUS ALARM, SIGNAL, AND SECURITY DETECTION SYSTEMS"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Rapiscan Systems Mobile 618XR hp x-ray machines, Puerto Rico",
    			summaryOfProcurement: "Firm-fixed-price contract for brand name commercial supply",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "This is a brand name specific requirement (FAR 13.106-1(b)(1)). The sole manufacturer of this equipment is Rapiscan Systems, Inc. (DUNS 802315069). The Buy American Act requires that preference be given to American made supplies.  When an exception applies, the contracting officer may acquire a foreign end product without regard to the restrictions of the Buy American statute.  One exception is when no American product is available. ",
    			expectedMaximumDurationOfTheRequestedWaiver: "0 - 6 months",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "MY",
    						Three: "MYS",
    						Numeric: 458,
    						Name: "MALAYSIA"
    					}
    				}
    			],
    			solicitationId: "12639522Q0085"
    		},
    		created: "2022-02-23T18:36:29.084Z",
    		modified: "2022-03-02T19:49:54.047Z"
    	},
    	{
    		_id: "6217cddc5631a8a9079de7bf",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "97AS",
    			contractingOfficeAgencyName: "DEFENSE LOGISTICS AGENCY (DLA)",
    			fundingAgencyId: "1700",
    			fundingAgencyName: "DEPT OF THE NAVY",
    			naics: {
    				NAICS_Code: 335110,
    				NAICS_Title: "Electric Lamp Bulb and Part Manufacturing"
    			},
    			psc: {
    				pscId: 740,
    				pscCode: "6240",
    				pscName: "ELECTRIC LAMPS"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Lamp, LED",
    			summaryOfProcurement: "I was recently made aware of this Buy American Waiver feature. Based on the solicitation; all Lamp, LED bulbs are mare in China and none of them are US made. Therefore no domestic Lamp, LED bulbs are available in the US. I request for the waiver to be approved in order to obtain the requested Lamp, LED bulbs that are only made in China through various manufacturers and authorized distributors.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "Requesting this waiver to be approved as the requested supplies (Lamp, LED bulbs) are not U.S. made product. They are only China made product that is available domestically in the U.S.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "CN",
    						Three: "CHN",
    						Numeric: 156,
    						Name: "CHINA"
    					}
    				}
    			],
    			solicitationId: "SPMYM122Q0043"
    		},
    		created: "2022-02-24T18:26:36.712Z",
    		modified: "2022-03-01T21:40:13.636Z"
    	},
    	{
    		_id: "61f837d252d0ae2824ff7ff0",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "12H2",
    			contractingOfficeAgencyName: "AGRICULTURAL RESEARCH SERVICE",
    			fundingAgencyId: "12H2",
    			fundingAgencyName: "AGRICULTURAL RESEARCH SERVICE",
    			naics: {
    				NAICS_Code: 221310,
    				NAICS_Title: "Water Supply and Irrigation Systems"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Point 4 LC3 central controller/monitor ",
    			summaryOfProcurement: "The USDA-ARS, National Cold Water Marine Aquaculture Center, Franklin, ME requires a Point 4 LC3 central controller/monitor able to incorporate at least 48 probes and be able to interact with the current monitoring equipment, Inwater Technologies, Point 4 RIU3 Remote Water Monitor/Controller system; probes, remote units, and alarms.\nThis system needs to be capable of measuring temperature, dissolved oxygen, and oxidation-reduction potential (ozone levels) from remote units in a recirculating aquaculture system (RAS). The vendor needs to supply the central controller/monitor, and a wireless communication system to connect the two outer buildings with the controller/monitor in the main building. The system must also be able to connect to their Point 4 RIU3 Remote Water Monitor/Controller system",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "An internet search was performed and no vendors were identified that could supply the\nrequired equipment capable of working with the current Point 4 RIU3 Remote Water\nMonitor/Controller system.  A US vendor Integrated Aquaculture was contacted and they confirmed the requirement is\nonly available from the non-U.S. manufacturer.   A Sources Sought notice was posted in SAM.gov between 01/05/2022 – 01/12/2022. No responses received.  An email request was sent to the vendor requesting information for distributors in the USA. They responded they are the sole manufacturer of the Point 4/InWater monitoring system including the LC3 and RIU3 and are the sole supplier for North America.",
    			expectedMaximumDurationOfTheRequestedWaiver: "0 - 6 months",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "CA",
    						Three: "CAN",
    						Numeric: 124,
    						Name: "CANADA"
    					}
    				}
    			],
    			solicitationId: "1051916SS"
    		},
    		created: "2022-01-31T19:26:10.682Z",
    		modified: "2022-02-10T12:53:53.250Z"
    	},
    	{
    		_id: "6202a557a407c4974ebee371",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "7022",
    			contractingOfficeAgencyName: "FEDERAL EMERGENCY MANAGEMENT AGENCY",
    			fundingAgencyId: "7022",
    			fundingAgencyName: "FEDERAL EMERGENCY MANAGEMENT AGENCY",
    			naics: {
    				NAICS_Code: 443141,
    				NAICS_Title: "Household Appliance Stores"
    			},
    			psc: {
    				pscId: 870,
    				pscCode: "7290",
    				pscName: "MISCELLANEOUS HOUSEHOLD AND COMMERCIAL FURNISHINGS AND APPLIANCES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Dehumidifiers",
    			summaryOfProcurement: "FEMA intends to procure 1000 dehumidifiers to be delivered in Baton Rouge, LA. These dehumidifiers are\nneeded for eligible disaster survivors housed in Transportable Temporary Housing Units (TTHUs) and are\nintended to sustain basic needs while a survivor occupies a TTHU. The dehumidifiers characteristics are\nbelow:\n􀁸 Capacity 40-45 pints per day (using DOE dehumidifier ratings 2020)\n􀁸 Passive drain\n􀁸 Analog or digital controls\n􀁸 Energy Star certified\n􀁸 No assembly required\n􀁸 Free of defects\n􀁸 Free of sharp, abrasive surfaces and edges\n􀁸 Dehumidified shall be in new and unused condition\n􀁸 UL or other nationally recognized testing laboratory listed\n􀁸 Minimum size: 17” wide, 11” deep\n􀁸 Maximum size: 20” wide, 20” deep",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: "70FB8022P00000003"
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "Since no qualified offers were received on this requirement as a 100% small business set-aside, FEMA issued a solicitation using full and open competition in compliance with the Trade Agreement Act (TAA). On October 20, 2021, this solicitation was issued on sam.gov. Eleven vendors responded; two vendors based in Iraq did not comply with the solicitation’s procedures and were\nadministratively rejected. Of the remaining nine qualified, eight provided products made in China, and one provided dehumidifiers claimed to be made in the US. An email was sent to the vendor who confirmed the dehumidifiers are manufactured in Wisconsin, and also provided the specification sheet. The US-made dehumidifiers offer of $2,412,650.00 was more than 1,000% above the IGCE/available funding of $225,000.00. Award could not be made as there are no exceptions to the TAA for unreasonable cost. When the solicitation was later reposted, an email was sent to the vendor about the new solicitation, but the vendor did not submit a new quote.\n\nOn November 22, 2021, a new RFQ was issued through the DHS reverse auction contracted vendor, UNISON in compliance with the BAA. Award was made to an offeror whose quote and Buy American Certificate confirmed its products are made in the US. Upon delivery and inspection, it was discovered that the dehumidifiers were made in China and therefore the award was terminated for cause on December 15, 2021. ",
    			expectedMaximumDurationOfTheRequestedWaiver: "0 - 6 months",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "CN",
    						Three: "CHN",
    						Numeric: 156,
    						Name: "CHINA"
    					}
    				}
    			],
    			solicitationId: "Multiple- See waiver info"
    		},
    		created: "2022-02-08T17:16:07.041Z",
    		modified: "2022-02-11T18:35:28.936Z"
    	},
    	{
    		_id: "61f9bcee52d0ae2824ff8165",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "6800",
    			contractingOfficeAgencyName: "ENVIRONMENTAL PROTECTION AGENCY",
    			fundingAgencyId: "6800",
    			fundingAgencyName: "ENVIRONMENTAL PROTECTION AGENCY",
    			naics: {
    				NAICS_Code: 562910,
    				NAICS_Title: "Remediation Services"
    			},
    			psc: {
    				pscId: 3176,
    				pscCode: "F999",
    				pscName: "OTHER ENVIRONMENTAL SERVICES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Scanlon ",
    			summaryOfProcurement: "U.S. Army Corps of Engineers, in partnership with EPA, administered a design effort to remediate the Scanlon portions of the Duluth Areas of Concern. Design required the use of SediMite, a product for which there are no alternatives that will meet design goals. EPA is contracting for implementation of this design, and the product in question is SediMite, an activated carbon pelletized material that is placed as part of capping efforts to remediate water beds. EPA is tasked with contracting for the implementation of this design that includes this material/product.\nhttp://www.sedimite.com/sedimite",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "U.S. Army Corps of Engineers, in partnership with EPA, administered a design effort to remediate the Scanlon portions of the Duluth Areas of Concern.  Design required the use of Sedimite, a product for which there are no alternatives that will meet design goals.  Sedimite is an activated carbon pelletized material that is placed as part of capping efforts to remediate water beds.  EPA is tasked with contracting for the implementation of this design that includes this material/product.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Between 6 months and 1 year",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "IN",
    						Three: "IND",
    						Numeric: 356,
    						Name: "INDIA"
    					}
    				}
    			],
    			solicitationId: "68HE0521R0024"
    		},
    		created: "2022-02-01T23:06:22.059Z",
    		modified: "2022-02-10T13:19:34.411Z"
    	},
    	{
    		_id: "62011ee03b2c3f689568580c",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "3600",
    			contractingOfficeAgencyName: "VETERANS AFFAIRS, DEPARTMENT OF",
    			fundingAgencyId: "3600",
    			fundingAgencyName: "VETERANS AFFAIRS, DEPARTMENT OF",
    			naics: {
    				NAICS_Code: 334515,
    				NAICS_Title: "Instrument Manufacturing for Measuring and Testing Electricity and Electrical Signals"
    			},
    			psc: {
    				pscId: 801,
    				pscCode: "6685",
    				pscName: "PRESSURE, TEMPERATURE, AND HUMIDITY MEASURING AND CONTROLLING INSTRUMENTS"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Temperature Probes for Temperature/Environmental Monitoring Systems in VISN 1 facilities",
    			summaryOfProcurement: "The Department of Veterans Affairs (VA) is in critical need of temperature probes for National Institute of Standards and Technology (NIST) recertification for the Temperature/ Environmental Monitoring Systems in VISN 1 VA facilities. These temperature probes (Temp Probe 2ft Round LCD -40C to +100C, NIST Replacement Kit) are to be procured for VA Boston Healthcare System (West Roxbury, Jamaica Plain, and Brockton Campuses), VA Bedford, VA Togus, VA Central Western MA, VA Providence, and VA Connecticut Healthcare System (West Haven and Newington Campuses), VA Manchester, and VA White River Junction.  The proposed action will be a sole source in accordance with FAR 6.302-2 Unusual and Compelling Urgency under the authority of 41 U.S.C.3304(a)(2) due to the immediate need for new probes.  The recertification is critical to the sustainment of the systems as the current probes expires on January 30, 2022 and the recertification is required to start on January 31, 2022.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: "36C10X22P0026"
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "The use of the non-domestic product is required for one year from date of award for this sole source action which includes installation of the probes and calibration services in the various facilities.  The supply chain issues identified in paragraph 2(iii) above have been ongoing for past six months or more and based on current global conditions are not expected to be fully resolved prior to the date proposed for this waiver.  Centrak is the only authorized Original Equipment Manufacturer (OEM) and does not manufacture these products domestically.  Their hardware, accessories, and software application for utilization and integration are proprietary and cannot be obtained by any other vendor.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Between 6 months and 1 year",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "CN",
    						Three: "CHN",
    						Numeric: 156,
    						Name: "CHINA"
    					}
    				},
    				{
    					countryOfOriginAndUSContent: {
    						Two: "HK",
    						Three: "HKG",
    						Numeric: 344,
    						Name: "HONG KONG"
    					}
    				}
    			],
    			solicitationId: ""
    		},
    		created: "2022-02-07T13:30:08.559Z",
    		modified: "2022-02-10T14:06:51.106Z"
    	},
    	{
    		_id: "61fd70033b2c3f68956851e9",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Ultra-High Frequency and Low Noise lock-in amplifier and PID Controller",
    			summaryOfProcurement: "Purchase One (1) lock-in amplifier model UHFLI and one (1) PID controller model UHF-PID",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: "1333ND22PNB680061 "
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "No Domestic product has been identified that can meet the Governments requirements.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "CH",
    						Three: "CHE",
    						Numeric: 756,
    						Name: "SWITZERLAND"
    					}
    				}
    			],
    			solicitationId: "1333ND22QNB680046"
    		},
    		created: "2022-02-04T18:27:15.139Z",
    		modified: "2022-02-11T13:34:08.957Z"
    	},
    	{
    		_id: "620160a7a407c4974ebee246",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 335999,
    				NAICS_Title: "All Other Miscellaneous Electrical Equipment and Component Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Six (6) effusion cells of varying types, One (1) rack mount, and One (1) rackmount controller ",
    			summaryOfProcurement: "Six (6) effusion cells: one low temperature effusion cell for Mg, one effusion cell for Al, one high temperature effusion cell for La, one  high temperature effusion cell for Fe, one  high temperature effusion cell for Ni, one oxygen atomic beam; One (1) rack mount, and One (1) rackmount controller ",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: "1333ND22PNB680065"
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "No Domestic product has been identified that can meet the Governments requirements",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "DE",
    						Three: "DEU",
    						Numeric: 276,
    						Name: "GERMANY"
    					}
    				}
    			],
    			solicitationId: "1333ND22QNB680046"
    		},
    		created: "2022-02-07T18:10:47.314Z",
    		modified: "2022-02-11T17:26:40.888Z"
    	},
    	{
    		_id: "61fad3e452d0ae2824ff8394",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "12K3",
    			contractingOfficeAgencyName: "ANIMAL AND PLANT HEALTH INSPECTION SERVICE",
    			fundingAgencyId: "12K3",
    			fundingAgencyName: "ANIMAL AND PLANT HEALTH INSPECTION SERVICE",
    			naics: {
    				NAICS_Code: 325320,
    				NAICS_Title: "Pesticide and Other Agricultural Chemical Manufacturing"
    			},
    			psc: {
    				pscId: 818,
    				pscCode: "6810",
    				pscName: "CHEMICALS"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Co-Ral Restricted Use Cattle Insecticide",
    			summaryOfProcurement: "Single award,  3-year Indefinite Delivery indefinite Quantity (IDIQ) type contract for Co-Ral brand name restricted use insecticide.  ",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "USDA, APHIS, VS has accepted coumaphos (Co-Ral 42%) in the specified strength for official use against cattle fever ticks as a permitted brand. Permitted brands are registered with the appropriate Federal agency and have undergone evaluation to ensure their efficacy when used in cooperative eradication and control programs, and at border ports of entry.  Co-Ral 42% is a restricted use product not available to the public and is the only such product approved for USDA use.   There is one manufacturer of the product and one distributor seller.  ",
    			expectedMaximumDurationOfTheRequestedWaiver: "Between 2 and 3 years",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			]
    		},
    		created: "2022-02-02T18:56:36.072Z",
    		modified: "2022-02-16T21:30:30.327Z"
    	},
    	{
    		_id: "62050e0fbaa79dbcd0a32f1a",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "3600",
    			contractingOfficeAgencyName: "VETERANS AFFAIRS, DEPARTMENT OF",
    			fundingAgencyId: "3600",
    			fundingAgencyName: "VETERANS AFFAIRS, DEPARTMENT OF",
    			naics: {
    				NAICS_Code: 325413,
    				NAICS_Title: "In-Vitro Diagnostic Substance Manufacturing"
    			},
    			psc: {
    				pscId: 772,
    				pscCode: "6550",
    				pscName: "IN VITRO DIAGNOSTIC SUBSTANCES, REAGENTS, TEST KITS AND SETS"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "COVID-19 Rapid Diagnostic and Serology/Antibody Tests for MAS - FSC 65 VII",
    			summaryOfProcurement: "The BD Veritor antigen test kits, that required TAA waiver, is a continued requirement for our VA Medical Centers (VAMC) and other agencies which use the Federal Supply Schedule. Alternative\tantigen tests have not evolved to include FluA/FluB like the BD Veritor has. We have VAMCs using this antigen test exclusively to test for COVID/FluA/FluB and have invested in both the instrument and the tests. Overall, influenza (flu) activity is still low nationally, but Center for Disease Control (CDC) surveillance systems continue to detect slow but steady increases in flu. (Flu Season | CDC) is still early in the flu season. The SARS-CoV-2, the virus that causes COVID-19, continues to evolve with new variants detected as recently as December 1, 2021 in the U.S. (Omicron Variant: What You Need to Know | CDC). The continued presence of the virus requires we remain capable of testing to stop the spread and in compliance with the federal mandate to test those that are unvaccinated. (President Biden's COVID-19 Plan | The White House) This product continues to be unique and would limit ability to render care if no longer available.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "N/A",
    			waiverRationaleSummary: "The BD Veritor antigen test kits, that required TAA waiver, is a continued requirement for our VA Medical Centers (VAMC). Alternative antigen tests have not evolved to include FluA/FluB like the BD Veritor has. We have VAMCs using this antigen test exclusively to test for COVID/FluA/FluB and have invested in both the instrument and the tests. Overall, influenza (flu) activity is still low nationally, but Center for Disease Control (CDC) surveillance systems continue to detect slow but steady increases in flu. (Flu Season | CDC) is still early in the flu season. The SARS-CoV-2, the virus that causes COVID-19, continues to evolve with new variants detected as recently as December 1, 2021 in the U.S. (Omicron Variant: What You Need to Know | CDC) The continued presence of the virus requires we remain capable of testing to stop the spread and in compliance with the federal mandate to test those that are unvaccinated. (President Biden's COVID-19 Plan | The White House) This product continues to be unique and would limit ability to render care if no longer available.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Between 1 and 2 years",
    			requestStatus: "Reviewed",
    			ombDetermination: "N/A",
    			solicitationId: "",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "CN",
    						Three: "CHN",
    						Numeric: 156,
    						Name: "CHINA"
    					}
    				}
    			]
    		},
    		created: "2022-02-10T13:07:27.338Z",
    		modified: "2022-02-10T13:07:27.338Z"
    	},
    	{
    		_id: "62029bda3b2c3f6895685991",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 334417,
    				NAICS_Title: "Electronic Connector Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Purchase of hand-formable high-quality assemblies with both SMA and SMK (2.92 mm) connectors",
    			summaryOfProcurement: "Purchase of hand-formable high-quality assemblies with both SMA and SMK (2.92 mm) connectors\n",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: "1333ND22PNB680066"
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "No Domestic product has been identified that can meet the Governments requirements.  Requirement was solicited with full and open competition.\n",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "JP",
    						Three: "JPN",
    						Numeric: 392,
    						Name: "JAPAN"
    					}
    				}
    			],
    			solicitationId: "1333ND22QNB680033"
    		},
    		created: "2022-02-08T16:35:38.955Z",
    		modified: "2022-02-11T17:59:20.777Z"
    	},
    	{
    		_id: "6216b1ebd85efd9c8bbab2a0",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "6800",
    			contractingOfficeAgencyName: "ENVIRONMENTAL PROTECTION AGENCY",
    			fundingAgencyId: "6800",
    			fundingAgencyName: "ENVIRONMENTAL PROTECTION AGENCY",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "ACQUITY Ultra-Performance Liquid Chromatographic (UPLC) Fluorescence Detector, one (1) each.  ",
    			summaryOfProcurement: "The Acquity Fluorescence Detector must be compatible with the Government owned Acquity ultra-performance liquid chromatographic (UPLC) - Waters Xevo TQ-S micro mass spectrometer (MS)  - both are manufactured by Waters Technologies Corporation.  The detector will be attached to the main spectrometer and use its software to operate.  This item is available on GSA and there are no substitutes available due to hardware/software combability requirements.  The item is manufactured in Singapore.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "N/A",
    			waiverRationaleSummary: "The Acquity Fluorescence Detector is needed to expand  capabilities in terms of the number of chemicals the EPA can quantitate and analyze within the  In Vitro Toxicokinetics Laboratory. This laboratory is an active participant across multiple research products and strategic research areas supported by either the Chemical Safety for Sustainability (CSS) and Safe and Sustainable Water Resource (SSWR) national programs. ",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Reviewed",
    			ombDetermination: "N/A",
    			countriesOfOriginAndUSContent: [
    			]
    		},
    		created: "2022-02-23T22:15:07.826Z",
    		modified: "2022-02-23T22:15:07.826Z"
    	},
    	{
    		_id: "61ef206b68f996ab77574e83",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Bruker BRAVO Raman Handheld Spectrometer",
    			summaryOfProcurement: "A handheld Raman spectrometer is critical to the mission for three separate programs of the Infrastructure Materials Group in the Engineering Laboratory (EL) at NIST.  A handheld Raman spectrometer is used for the characterization of materials in the field before and after long-term weathering or hazard events. Field-based Raman characterization is needed to obtain molecular bonding information in order to classify materials and understand degradation modes.  Specifically, the “Engineered Materials for Resilient Infrastructure” program involves the field characterization of infrastructure materials, including weathered polymers, polymer composites, and concrete. The “Earthquake Risk Reduction” program investigates the durability and field performance of fiber reinforced composites (e.g. “Reliability of Fiber Reinforced Composites in Infrastructure” project). Additionally, the “Net Zero Energy Research” program requires the field characterization of solar panel materials within solar arrays at NIST and at different sites across the United States. \n",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: "1333ND22PNB730050"
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "It has been determined that only the BRAVO handheld Raman spectrometer meets all of NIST’s requirements and confirmed that the Bruker BRAVO is manufactured in Germany. Bruker Scientific, LLC is the original equipment manufacturer and sole source supplier of the BRAVO and so a waiver is required to be able to purchase this mission critical equipment for the NIST Engineering Laboratory.\n",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "DE",
    						Three: "DEU",
    						Numeric: 276,
    						Name: "GERMANY"
    					}
    				}
    			],
    			solicitationId: "NIST-RFQ-21-00211",
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2022-01-24T21:55:55.351Z",
    		modified: "2022-01-26T20:27:16.589Z"
    	},
    	{
    		_id: "61f19a2a6808f23cbf71187f",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1434",
    			contractingOfficeAgencyName: "US GEOLOGICAL SURVEY",
    			fundingAgencyId: "1434",
    			fundingAgencyName: "US GEOLOGICAL SURVEY",
    			naics: {
    				NAICS_Code: 334511,
    				NAICS_Title: "Search, Detection, Navigation, Guidance, Aeronautical, and Nautical System and Instrument Manufacturing "
    			},
    			psc: {
    				pscId: 620,
    				pscCode: "5825",
    				pscName: "RADIO NAVIGATION EQUIPMENT, EXCEPT AIRBORNE"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Global Positioning System – Acoustic Method (GPS-A) Module",
    			summaryOfProcurement: "USGS is purchasing a Global Positioning System – Acoustic Method (GPS-A) Module to measure the deformation leading up to and including subduction zone earthquakes that represent a significant hazard to the United States. ",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "The USGS has already invested $500,000.00 in deploying Sonardyne transponders on the seafloor offshore Oregon, to include the cost of six transponders, auxiliary monumentation equipment, ship-time for deployment. The USGS would need to spend approximately $535,000.00 to replace the existing technology if we are unable purchase the Sonardyne GPS-A module.\nThe original transponders were chosen non-competitively on the scientific basis that the Sonardyne seafloor transponders were the only transponders that: a) permitted the millimeter to centimeter absolute seafloor positioning resolution required to sense the earthquake cycle seafloor displacements and b) were compatible with the waveglider measuring platform that both our National Science Foundation-funded collaborators and the USGS utilize. The autonomous waveglider platform was a novel technique that replaced an exponentially more expensive option of using an ocean-going vessel to perform the measuring. The waveglider platform is what enables the USGS to make these scientific measurements. The Sonardyne transponders are the only ocean surface instrumentation that support communication and compatibility with the proprietary technology of the existing equipment.",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			],
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2022-01-26T18:59:54.278Z",
    		modified: "2022-02-09T13:47:54.470Z"
    	},
    	{
    		_id: "61eafad468f996ab77574a87",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "8000",
    			contractingOfficeAgencyName: "NATIONAL AERONAUTICS AND SPACE ADMINISTRATION",
    			fundingAgencyId: "8000",
    			fundingAgencyName: "NATIONAL AERONAUTICS AND SPACE ADMINISTRATION",
    			naics: {
    				NAICS_Code: 236210,
    				NAICS_Title: "Industrial Building Construction"
    			},
    			psc: {
    				pscId: 5721,
    				pscCode: "Z2AZ",
    				pscName: "REPAIR OR ALTERATION OF OTHER ADMINISTRATIVE FACILITIES AND SERVICE BUILDINGS"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Utility Energy Service Contract (UESC)",
    			summaryOfProcurement: "The Task Order (TO) incorporates UESC Phase 1 Engineering and Design Implementation; and Operation and Maintenance and includes the Feasibility Study.  On part of this project replaces existing florescent T5 lamps with new LED T5 lamps.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: "80KSC021F0111"
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "In accordance with Federal Acquisition Regulation (FAR) 25.103, the Contracting Officer (CO) may acquire the foreign end product identified without regard to the restrictions of the Buy American Act, under the authority of the Nonavailability exception (b)(2)(i). This authorization is based upon the determination that the articles, materials, or supplies to be procured are not mined, produced, or manufactured in the United States (U.S.) in sufficient and reasonably available commercial quantities of a satisfactory quality.",
    			requestStatus: "Reviewed",
    			ombDetermination: "Inconsistent with Policy",
    			countriesOfOriginAndUSContent: [
    				{
    					countryiesOfOriginAndUSContent: "",
    					countryOfOriginAndUSContent: {
    						Two: "CN",
    						Three: "CHN",
    						Numeric: 156,
    						Name: "CHINA"
    					}
    				}
    			],
    			solicitationId: "",
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2022-01-21T18:26:28.205Z",
    		modified: "2022-02-03T20:14:37.033Z"
    	},
    	{
    		_id: "61e9b8116808f23cbf710a3a",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1434",
    			contractingOfficeAgencyName: "US GEOLOGICAL SURVEY",
    			fundingAgencyId: "1434",
    			fundingAgencyName: "US GEOLOGICAL SURVEY",
    			naics: {
    				NAICS_Code: 334513,
    				NAICS_Title: "Instruments and Related Products Manufacturing for Measuring, Displaying, and Controlling Industrial Process Variables "
    			},
    			psc: {
    				pscId: 791,
    				pscCode: "6655",
    				pscName: "GEOPHYSICAL INSTRUMENTS"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Aquadopp Profiler 1mHZ measurement instrument",
    			summaryOfProcurement: "USGS is purchasing a specialized instrument that accurately measure the grains of sand. The current instrument is failing, and this is the procurement for the replacement. ",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "USGS is purchasing a specialized instrument that accurately measure the grains of sand. The current instrument is failing, and this is the procurement for the replacement. A Notice of Intent to Solicit from a Single Source was posted on SAM.gov on 12/01/2021, and no responses were received by the closing date of 12/11/2021. NortekUSA Inc. is the only manufacturer of this end product, which is manufactured in Oslo, Norway. NortekUSA .",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			],
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2022-01-20T19:29:21.686Z",
    		modified: "2022-01-27T14:07:20.658Z"
    	},
    	{
    		_id: "61e1ace0fab68d3659e021eb",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "6920",
    			contractingOfficeAgencyName: "FEDERAL AVIATION ADMINISTRATION",
    			fundingAgencyId: "6920",
    			fundingAgencyName: "FEDERAL AVIATION ADMINISTRATION",
    			naics: {
    				NAICS_Code: 334220,
    				NAICS_Title: "Radio and Television Broadcasting and Wireless Communications Equipment Manufacturing"
    			},
    			psc: {
    				pscId: 5935,
    				pscCode: "5820",
    				pscName: "RADIO AND TELEVISION COMMUNICATION EQUIPMENT, EXCEPT AIRBORNE"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Maintenance Communication Transceivers (MCT)",
    			summaryOfProcurement: "The FAA is acquiring Very High Frequency (VHF) commercially-available transceivers (two-way radios) designed specifically for the aviation industry. Acquisition includes a handheld and mobile (vehicle mounted) configurations, as well as accessories and spare parts for each configuration.",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Multi-procurement Waiver",
    			waiverRationaleSummary: "The FAA is acquiring Very High Frequency (VHF) commercially-available transceivers (two-way radios) designed specifically for the aviation industry. Acquisition includes a handheld and mobile (vehicle mounted) configurations, as well as accessories and spare parts for each configuration.",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			],
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2022-01-14T17:03:28.469Z",
    		modified: "2022-01-28T11:38:34.802Z"
    	},
    	{
    		_id: "61b7325e01982708b7b65df1",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 333314,
    				NAICS_Title: "Optical Instrument and Lens Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "External cavity diode lasers, high power, spectrally narrow, source of light that is tunable for wavelengths of 480-484 nm and 780-781 nm ",
    			summaryOfProcurement: "The National Institute of Standards and Technology (NIST) Thermodynamic Metrology group is developing a Rydberg rubidium atom experiment that will enable quantum metrology of thermal radiation.  This project requires i) a high-power, spectrally narrow source of laser light that is tunable for wavelengths from 480-484nm and ii) a high-power, spectrally narrow source of laser light that is tunable for wavelengths from 780-781.  The requirements are for lasers that can produce these wavelengths at high power with long-term frequency stability.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "No Domestic product has been identified that can meet the Governments requirements and the sole source manufacturer (Toptica Photonics, Inc.) manufactures this equipment in Germany.  Therefore, it does not qualify as a us end product. ",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			],
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2021-12-13T11:45:34.330Z",
    		modified: "2021-12-17T21:37:54.242Z"
    	},
    	{
    		_id: "61ca135b66d0a748fcf1954f",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "3600",
    			contractingOfficeAgencyName: "VETERANS AFFAIRS, DEPARTMENT OF",
    			fundingAgencyId: "3600",
    			fundingAgencyName: "VETERANS AFFAIRS, DEPARTMENT OF",
    			naics: {
    				NAICS_Code: 337215,
    				NAICS_Title: "Showcase, Partition, Shelving, and Locker Manufacturing "
    			},
    			psc: {
    				pscId: 859,
    				pscCode: "7125",
    				pscName: "CABINETS, LOCKERS, BINS, AND SHELVING"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Phoenix Package 20 - Shelving",
    			summaryOfProcurement: "Veteran Affairs Phoenix Health Care System has a requirement to purchase Shelving Units from an authorized vendor.  This is a Brand Name or Equal Requirement. The requirement is in support of the activation of Phoenix VA Clinic – 32nd Street Project. The new Outpatient Clinic has the need for 53 Plastic Shelving Units and 40 Wire Shelving Units to help with storage needs throughout the facility. Metro Shelving units are the basis for design.‬‬‬‬‬‬‬‬‬‬‬‬‬‬‬",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: "36C77622P0022"
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "N/A",
    			waiverRationaleSummary: "Although the Buy American Act is applicable to small business set-asides (FAR 25.101(b)), we would be exercising an exception to the Buy American Act (FAR 25.103(b) Nonavailability) by utilizing a foreign manufacturer, as the lowest price technically acceptable quote received from a Small Business is quoting foreign manufactured products.  No domestic end products were quoted.",
    			requestStatus: "Reviewed",
    			ombDetermination: "N/A",
    			solicitationId: "36C77622Q0067",
    			countriesOfOriginAndUSContent: [
    			],
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2021-12-27T19:26:19.312Z",
    		modified: "2021-12-27T19:26:19.312Z"
    	},
    	{
    		_id: "61c20dbb66d0a748fcf1649f",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "5700",
    			fundingAgencyName: "DEPT OF THE AIR FORCE",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Procurement for a Radiation Imaging Spectrometer",
    			summaryOfProcurement: "Solicited on SAM.gov as a brand name only Imaging Spectrometer manufactured in the Czech Republic\n\n",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "The requirement was solicited via SAM.gov as a brand-name only requirement utilizing simplified acquisition procedures. Two quotations were received. One from the manufacture and one from the manufactures U.S. authorized reseller. Both quotations were evaluated as meeting the requirements of the solicitation. The lowest priced technically acceptable quotation from ADVACAM has been selected for award.\nThe WidePIX and previously purchased MiniPIX are manufactured by ADVACAM s.r.o. ADVACAM is located and manufactures within the Czech Republic",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			solicitationId: "1333ND22QNB640027",
    			countriesOfOriginAndUSContent: [
    			],
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2021-12-21T17:24:11.650Z",
    		modified: "2021-12-28T22:30:21.335Z"
    	},
    	{
    		_id: "61c4ef82484052b04328d798",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1700",
    			contractingOfficeAgencyName: "DEPT OF THE NAVY",
    			fundingAgencyId: "9761",
    			fundingAgencyName: "DEFENSE THREAT REDUCTION AGENCY (DTRA)",
    			naics: {
    				NAICS_Code: 238210,
    				NAICS_Title: "Electrical Contractors and Other Wiring Installation Contractors"
    			},
    			psc: {
    				pscId: 5756,
    				pscCode: "Z2HZ",
    				pscName: "REPAIR OR ALTERATION OF GOVERNMENT-OWNED GOVERNMENT-OPERATED (GOGO) ENVIRONMENTAL LABORATORIES"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Dual Tone Doorbell",
    			summaryOfProcurement: "As per the contract, it was required that contractor install a dual tone doorbell to distinguish at which entry the doorbell was being used. It was unknown before award that it would not be possible to find an American sourced doorbell that met these requirements. After a thorough search done by the contractor, the government was notified that a dual tone doorbell sourced in America was difficult to find and contractor requested the use of a dual tone doorbell sourced in China. The Government conducted their own research to find there are no such comparable products produced in the United States that meet the requirements for this application. Research was conducted by an online search of multiple manufacturers, Enclosure (2), and also by speaking with a manufacturer from Nicor. The representative from Nicor stated that practically all units are manufactured overseas and that it would be impossible to find a dual tone doorbell manufactured in America.",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "Market research was accomplished and no dual tone doorbell manufactured in America was found by either the Government via a sources sought or the contractor and  their sub-contractor.",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			],
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2021-12-23T21:52:02.068Z",
    		modified: "2022-01-03T18:22:25.887Z"
    	},
    	{
    		_id: "61cc843966d0a748fcf19aef",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "3600",
    			contractingOfficeAgencyName: "VETERANS AFFAIRS, DEPARTMENT OF",
    			fundingAgencyId: "3600",
    			fundingAgencyName: "VETERANS AFFAIRS, DEPARTMENT OF",
    			naics: {
    				NAICS_Code: 335311,
    				NAICS_Title: "Power, Distribution, and Specialty Transformer Manufacturing "
    			},
    			psc: {
    				pscId: 741,
    				pscCode: "6250",
    				pscName: "BALLASTS, LAMPHOLDERS, AND STARTERS"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Phoenix Package # 162 - Outlet Strips",
    			summaryOfProcurement: "Veterans Affairs Phoenix Health Care System has a requirement to purchase Outlet Strips form an authorized vendor.  This is a Brand Name or Equal Requirement.  The requirement is in support of the activation of Phoenix VA Clinic - 32nd Street Project.  The new Outpatient Clinic has the need for 231 Outlet Strips throughout the facility.  Tripp-Lite is the basis for design.",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "Although the Buy American Act is applicable to small business set-asides (FAR 25.101(b)), we would be exercising an exception to the Buy American Act (FAR 25.103(b) Non-availability) by utilizing a foreign manufacturer, as the lowest price technically acceptable quote received from a Small Business is quoting foreign manufactured products.  No domestic end products were quoted.\n",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			solicitationId: "36C77622Q0032",
    			countriesOfOriginAndUSContent: [
    			],
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2021-12-29T15:52:25.843Z",
    		modified: "2022-01-05T23:45:05.846Z"
    	},
    	{
    		_id: "619ba97fae4010a061faceba",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1341",
    			contractingOfficeAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			fundingAgencyId: "1341",
    			fundingAgencyName: "NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY",
    			naics: {
    				NAICS_Code: 334515,
    				NAICS_Title: "Instrument Manufacturing for Measuring and Testing Electricity and Electrical Signals"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Reverberation and Anechoic Chamber",
    			summaryOfProcurement: "The National Institute of Standards and Technology (NIST) Information Technology Laboratory (ITL) is in the process of expanding its applied cybersecurity research efforts related to 5G cybersecurity. This work spans a broad area covering topics associated with both traditional information technology cybersecurity as well as cybersecurity for mobile networks requiring radio frequency (RF) isolation. This environment ensures that its interior volume is shielded from signals radiated from outside the chamber. Such a shielded research facility can come in the form of either an anechoic chamber or a reverberation chamber. \n\nIn an anechoic chamber, the walls and ceiling inside the chamber are equipped with absorbing material such that signals radiated from within the chamber are absorbed and do not scatter (ideally). In a reverberation chamber, the opposite is true. The walls and ceiling in a reverberation chamber are designed to be reflective (metallic) at radio frequencies of interest. Most anechoic and reverberation chambers are designed, built, and used for testing pursuant to specific electromagnetic capability (EMC) standards (e.g., IEC 61000-4-3). As this chamber will be used for wireless communications research, it is neither feasible nor reasonable to specify the exact application and/or measurements that will take place within the chamber.\n\nThe purpose of this requirement is to obtain a free-standing RF Shielded Chamber for research purposes. Installation shall take place at the National Cybersecurity Center of Excellence facility in Rockville, MD. This is a firm fixed price requirement.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: "1333ND22PNB770013"
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "The results of market research conducted for this requirement demonstrated that the primary places of manufacture for components of reverberation and anechoic chambers are foreign. While American small businesses are found to sell the required chambers, no contractors offering domestic products were identified. \n\nNIST conducted a competitive acquisition on a total small business set-aside basis for a reverberation and anechoic chamber meeting NIST’s minimum specifications. The solicitation was posted with ample time for all potential contractors to submit a quotation for the commercial requirement. The solicitation was later also extended by a week to maximize opportunity for competition. Two quotations were received in reference to the solicitation. Only one quotation, from AP Americas, Inc., was determined to be technically acceptable and this quotation included foreign end products. The other quotation received did not include the required fire suppression system, and was therefore non-compliant with NIST’s required specifications and was technically unacceptable. The only technically acceptable products quoted to NIST are therefore manufactured outside of the United States.  After evaluating all quotations in accordance with the solicitation, the quoter that represents the best value to the Government is AP Americas, Inc., offering foreign end products. NIST intends to purchase a reverberation and anechoic chamber that is primarily manufactured in Germany.  For the reasons detailed above, there are no domestic products that meet NIST’s specifications.\n",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			solicitationId: "NIST-RFQ-21-7701954",
    			countriesOfOriginAndUSContent: [
    			],
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2021-11-22T14:30:23.211Z",
    		modified: "2021-12-01T16:49:00.982Z"
    	},
    	{
    		_id: "618e9b85f6a478f23f267e9b",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1605",
    			contractingOfficeAgencyName: "OFFICE OF THE ASSISTANT SECRETARY FOR ADMINISTRATION AND MANAGEMENT",
    			fundingAgencyId: "1625",
    			fundingAgencyName: "BUREAU OF LABOR STATISTICS",
    			naics: {
    				NAICS_Code: 334118,
    				NAICS_Title: "Computer Terminal and Other Computer Peripheral Equipment Manufacturing"
    			},
    			psc: {
    				pscId: 891,
    				pscCode: "7520",
    				pscName: "OFFICE DEVICES AND ACCESSORIES"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Brand Name Kensington BlackBelt Rugged Cases for Surface Pro with a common access card (CAC) Reader",
    			summaryOfProcurement: "The Bureau of Labor Statistics (BLS) Division of Technology and Network Management (DTNM) needs to procure Kensington BlackBelt Rugged Cases for Surface Pro with a CAC Reader to replace cases for tablets that are used in the field.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "Extensive market research has been conducted by reviewing available products within the General Services Administration (GSA), Multiple Award Schedule (MAS), National Aeronautics and Space Administration (NASA) Scientific and Engineering Workstation Procurement (SEWP), and Government-wide Acquisition Contract (GWAC). There are only two Microsoft Surface Pro cases on the market that can meet the Consumer Price Index (CPI) Office of Field Operations (OFO) requirements: the Kensington BlackBelt Rugged Case and the Griffin Survivor Security Case. Per GSA Advantage, neither of these cases are manufactured within the United States as both cases originate in Taiwan.",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			],
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2021-11-12T16:51:17.529Z",
    		modified: "2021-11-13T14:21:35.713Z"
    	},
    	{
    		_id: "618c3974c71178cacb443e2f",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1605",
    			contractingOfficeAgencyName: "OFFICE OF THE ASSISTANT SECRETARY FOR ADMINISTRATION AND MANAGEMENT",
    			fundingAgencyId: "1650",
    			fundingAgencyName: "OCCUPATIONAL SAFETY AND HEALTH ADMINISTRATION",
    			naics: {
    				NAICS_Code: 334519,
    				NAICS_Title: "Other Measuring and Controlling Device Manufacturing"
    			},
    			psc: {
    				pscId: 551,
    				pscCode: "5220",
    				pscName: "INSPECTION GAGES AND PRECISION LAYOUT TOOLS"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Pylon AB7 Monitor",
    			summaryOfProcurement: "The OSHA SLTC Health Response Team (HRT) uses portable radiation monitors to support Compliance Safety and Health Officer (CSHO) inspections of worker exposures to airborne radon hazards in a variety of industries. OSHA SLTC requires one Pylon AB7 Portable Radiation Monitor system to replace its current radiation monitor (Pylon AB5) which has been in service for more than 20 years.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "The Pylon AB7 is the only portable radiation monitor that meets OSHA’s requirement for evaluating airborne radon concentration in real-time. The Pylon AB7 is not produced in the U.S., and a formal market analysis revealed there is no comparable product produced in the U.S.",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			],
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2021-11-10T21:28:20.713Z",
    		modified: "2021-11-13T13:55:18.079Z"
    	},
    	{
    		_id: "618c37bd5d13ab17486984cd",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1605",
    			contractingOfficeAgencyName: "OFFICE OF THE ASSISTANT SECRETARY FOR ADMINISTRATION AND MANAGEMENT",
    			fundingAgencyId: "1650",
    			fundingAgencyName: "OCCUPATIONAL SAFETY AND HEALTH ADMINISTRATION",
    			naics: {
    				NAICS_Code: 334513,
    				NAICS_Title: "Instruments and Related Products Manufacturing for Measuring, Displaying, and Controlling Industrial Process Variables "
    			},
    			psc: {
    				pscId: 782,
    				pscCode: "6630",
    				pscName: "CHEMICAL ANALYSIS INSTRUMENTS"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Procurement of Fourier Transformation Infrared (FTIR) Spectroscopy Analyzer",
    			summaryOfProcurement: "This procurement is for Fourier Transformation Infrared (FTIR) Spectroscopy, in support of Occupational Safety and Health Administration (OSHA), used for inspections in response to identifying unknown chemical hazards.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "The FTIR is a unique piece of equipment.  While there are other types of this instrument produced, they cannot perform the same function across multiple analyses or in variable atmospheric conditions meaning they are unable to detect a wide variety of gases and vapors simultaneously.",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			],
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2021-11-10T21:21:01.518Z",
    		modified: "2021-11-13T13:57:42.219Z"
    	},
    	{
    		_id: "618c3a2ac71178cacb443e42",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1605",
    			contractingOfficeAgencyName: "OFFICE OF THE ASSISTANT SECRETARY FOR ADMINISTRATION AND MANAGEMENT",
    			fundingAgencyId: "1650",
    			fundingAgencyName: "OCCUPATIONAL SAFETY AND HEALTH ADMINISTRATION",
    			naics: {
    				NAICS_Code: 334519,
    				NAICS_Title: "Other Measuring and Controlling Device Manufacturing"
    			},
    			psc: {
    				pscId: 786,
    				pscCode: "6636",
    				pscName: "ENVIRONMENTAL CHAMBERS AND RELATED EQUIPMENT"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Powered Air Purifying Respirator (PAPR) and HEPA filter.",
    			summaryOfProcurement: "This is a request to purchase Powered Air Purifying Respirator (PAPR) and HEPA filter.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "Powered Air Purifying Respirator (PAPR) and HEPA filter were found that meet CTC's requirements, but there were no products manufactured domestically. The proposed models are manufactured by 3M, a U.S. based company, however, their products are manufactured in Poland and Canada, respectively. ",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			],
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2021-11-10T21:31:22.214Z",
    		modified: "2021-11-13T14:17:09.257Z"
    	},
    	{
    		_id: "618c431c3364ec841c6520af",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1605",
    			contractingOfficeAgencyName: "OFFICE OF THE ASSISTANT SECRETARY FOR ADMINISTRATION AND MANAGEMENT",
    			fundingAgencyId: "1650",
    			fundingAgencyName: "OCCUPATIONAL SAFETY AND HEALTH ADMINISTRATION",
    			naics: {
    				NAICS_Code: 333997,
    				NAICS_Title: "Scale and Balance Manufacturing"
    			},
    			psc: {
    				pscId: 796,
    				pscCode: "6670",
    				pscName: "SCALES AND BALANCES"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Procurement of Laboratory Information Management System (LIMS) Integrated Analytical Balance",
    			summaryOfProcurement: "This is a request to purchase one LIMS Integrated Analytical Balance, to include installation, calibration, and a service plan.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "Multiple analytical balances were found that meet SLTC’s requirements, but there were no products manufactured domestically. The two  models found are sold by U.S. based companies; Mettler-Toledo, LLC and Sartorius Corporation, however, their products are manufactured in Switzerland and Germany, respectively. ",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			],
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2021-11-10T22:09:32.679Z",
    		modified: "2021-11-13T14:18:26.053Z"
    	},
    	{
    		_id: "618e997ff6a478f23f267e89",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "1605",
    			contractingOfficeAgencyName: "OFFICE OF THE ASSISTANT SECRETARY FOR ADMINISTRATION AND MANAGEMENT",
    			fundingAgencyId: "1650",
    			fundingAgencyName: "OCCUPATIONAL SAFETY AND HEALTH ADMINISTRATION",
    			naics: {
    				NAICS_Code: 334519,
    				NAICS_Title: "Other Measuring and Controlling Device Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Procurement of Fluke Laser Distance Meters",
    			summaryOfProcurement: "The OSHA Cincinnati Technical Center (CTC) has identified a requirement for (52) Fluke 424D laser distance meters for OSHA field office enforcement inspections.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "Multiple distance meters are available however, none of these meet the CTC requirements. OSHA has equipment of this make and model throughout the agency. The agency possess institutional knowledge, training and experience to service the equipment on the agency's behalf, without incurring additional costs.    ",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			],
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2021-11-12T16:42:39.205Z",
    		modified: "2021-11-13T14:19:53.869Z"
    	},
    	{
    		_id: "61951f9acda9e25574f11458",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "7013",
    			contractingOfficeAgencyName: "TRANSPORTATION SECURITY ADMINISTRATION",
    			fundingAgencyId: "7013",
    			fundingAgencyName: "TRANSPORTATION SECURITY ADMINISTRATION",
    			naics: {
    				NAICS_Code: 424320,
    				NAICS_Title: "Men's and Boys' Clothing and Furnishings Merchant Wholesalers"
    			},
    			psc: {
    				pscId: 963,
    				pscCode: "8405",
    				pscName: "OUTERWEAR, MEN'S"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Tactical Pants for TSA Federal Air Marshals",
    			summaryOfProcurement: "Delivery order for uniform items, I.e. tactical pants for TSA Federal Air Marshals",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Multi-procurement Waiver",
    			waiverRationaleSummary: "N/A",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			solicitationId: "",
    			countriesOfOriginAndUSContent: [
    			],
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2021-11-17T15:28:26.862Z",
    		modified: "2021-11-17T15:38:56.816Z"
    	},
    	{
    		_id: "619540ccf56f2c4cbc6c7c13",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "97AS",
    			contractingOfficeAgencyName: "DEFENSE LOGISTICS AGENCY (DLA)",
    			fundingAgencyId: "97AS",
    			fundingAgencyName: "DEFENSE LOGISTICS AGENCY (DLA)",
    			naics: {
    				NAICS_Code: 325220,
    				NAICS_Title: "Artificial and Synthetic Fibers and Filaments Manufacturing"
    			},
    			psc: {
    				pscId: 1038,
    				pscCode: "9420",
    				pscName: "FIBERS:  VEGETABLE, ANIMAL, AND SYNTHETIC"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Rayon",
    			summaryOfProcurement: "ENKA 300/60 AS Select rayon",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "N/A",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			],
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2021-11-17T17:50:04.738Z",
    		modified: "2021-11-17T18:48:07.711Z"
    	},
    	{
    		_id: "61954565f56f2c4cbc6c7c40",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "97AS",
    			contractingOfficeAgencyName: "DEFENSE LOGISTICS AGENCY (DLA)",
    			fundingAgencyId: "97AS",
    			fundingAgencyName: "DEFENSE LOGISTICS AGENCY (DLA)",
    			naics: {
    				NAICS_Code: 333415,
    				NAICS_Title: "Air-Conditioning and Warm Air Heating Equipment and Commercial and Industrial Refrigeration Equipment Manufacturing"
    			},
    			psc: {
    				pscId: 674,
    				pscCode: "5985",
    				pscName: "ANTENNAS, WAVEGUIDES, AND RELATED EQUIPMENT"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "IDC under SAT, repair part",
    			summaryOfProcurement: "This item is code and Part Number (PN) with only 2 approved/technically acceptable sources (cage 4H538 and 06090). All offers quoted CAGE 06090 which imports materials from Mexico.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: "SPE7M5-21-D-62MQ"
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "All offers responding to this competitive solicitation quoted a PN that is considered a part out of Mexico. There are no other alternatives.",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			solicitationId: "SPE7M5-21-U-0380",
    			countriesOfOriginAndUSContent: [
    			],
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2021-11-17T18:09:41.734Z",
    		modified: "2021-11-17T18:51:07.812Z"
    	},
    	{
    		_id: "6195475af56f2c4cbc6c7c52",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "97AS",
    			contractingOfficeAgencyName: "DEFENSE LOGISTICS AGENCY (DLA)",
    			fundingAgencyId: "97AS",
    			fundingAgencyName: "DEFENSE LOGISTICS AGENCY (DLA)",
    			naics: {
    				NAICS_Code: 336412,
    				NAICS_Title: "Aircraft Engine and Engine Parts Manufacturing"
    			},
    			psc: {
    				pscId: 271,
    				pscCode: "2840",
    				pscName: "GAS TURBINES AND JET ENGINES, AIRCRAFT, PRIME MOVING; AND COMPONENTS"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "T700 Turboshaft Engine",
    			summaryOfProcurement: "Performance-based logistics contract supporting GE T700 Engine consumables for US Army Depot (CCAD) and World-wide/FMS customers.",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: "SPE4AX21D9416"
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "Mission failure due to inability to procure T700 Engine parts.",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			solicitationId: "SPE4AX21R0001",
    			countriesOfOriginAndUSContent: [
    			],
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2021-11-17T18:18:02.772Z",
    		modified: "2021-11-17T18:53:08.485Z"
    	},
    	{
    		_id: "61954271f56f2c4cbc6c7c2c",
    		state: "submitted",
    		data: {
    			contractingOfficeAgencyId: "97AS",
    			contractingOfficeAgencyName: "DEFENSE LOGISTICS AGENCY (DLA)",
    			fundingAgencyId: "97AS",
    			fundingAgencyName: "DEFENSE LOGISTICS AGENCY (DLA)",
    			naics: {
    				NAICS_Code: 325180,
    				NAICS_Title: "Other Basic Inorganic Chemical Manufacturing"
    			},
    			psc: {
    				pscId: 1061,
    				pscCode: "9620",
    				pscName: "MINERALS, NATURAL AND SYNTHETIC"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Cerium Carbonate",
    			summaryOfProcurement: "\"The DLA Contracting Services Office - Fort Belvoir (DCSO-F2), proposes to purchase1,662 metric tons (MT) of Cerium Carbonate Powder. The estimated annual delivery schedule of 416 MT is valued at $2,220,854.00. The total estimated value is approximately\n $8,883,416.00 over a period of 48-months (one base and 3 option periods of 12\n months each). The reason for requesting the waiver is that Cerium Carbonate meets the definition of a material which is not\n mined, produced, or manufactured in the United States in sufficient and reasonably\n available commercial quantities and of a satisfactory quality.\"\t",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "N/A",
    			requestStatus: "Reviewed",
    			ombDetermination: "Consistent with Policy",
    			countriesOfOriginAndUSContent: [
    			],
    			expectedMaximumDurationOfTheRequestedWaiver: "N/A"
    		},
    		created: "2021-11-17T17:57:05.946Z",
    		modified: "2021-11-17T18:49:38.563Z"
    	},
    	{
    		_id: "62752163c24cde4e8b44e44b",
    		data: {
    			contractingOfficeAgencyId: "1434",
    			contractingOfficeAgencyName: "US GEOLOGICAL SURVEY",
    			fundingAgencyId: "1434",
    			fundingAgencyName: "US GEOLOGICAL SURVEY",
    			naics: {
    				NAICS_Code: 334516,
    				NAICS_Title: "Analytical Laboratory Instrument Manufacturing"
    			},
    			psc: {
    				pscId: 787,
    				pscCode: "6640",
    				pscName: "LABORATORY EQUIPMENT AND SUPPLIES"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Spectrophotometer",
    			summaryOfProcurement: "The spectrophotometer system allows for continuity of data while also eliminating the need for the construction of a standalone core workflow apparatus, saving time during data acquisition, and circumventing potential pitfalls of data mismanagement. The existing Multi-Sensor Core Logger system analyzes earth core samples for historic earthquake and volcanic activity, which is part of on-going USGS mission-critical research.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "The USGS requires a color spectrophotometer upgrade to an existing USGS-owned instrument for core sample measurements. The existing system analyzes earth core samples for historic earthquake and volcanic activity, which is part of on-going USGS mission-critical research. This research is used for understanding past occurrences and predicting future possible geologic events. Ongoing PCMSC research projects require a more comprehensive and less subjective color assessment of lithostratigraphy (rock/earth layers). Not having seamless integration with the existing MSCL system will require the lab to construct a new standalone core work-flow apparatus and exposes users to (1) substantially longer analysis time requirements, (2) user errors during data collection, and (3) a much higher likelihood of data mismanagement regarding data archive and QMS policy requirements. If a spectrophotometer from an alternate manufacturer was purchased, it would result in significantly increased analysis times and unacceptable delays in completion of science products across a variety of USGS research projects and the acquisition of a replacement system at a cost of approximately $400,000.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Submitted",
    			ombDetermination: "N/A",
    			countriesOfOriginAndUSContent: [
    			]
    		},
    		state: "submitted",
    		created: "2022-05-06T13:23:47.793Z",
    		modified: "2022-05-06T13:23:47.793Z"
    	},
    	{
    		_id: "62752590c24cde4e8b44e467",
    		data: {
    			contractingOfficeAgencyId: "1434",
    			contractingOfficeAgencyName: "US GEOLOGICAL SURVEY",
    			fundingAgencyId: "1434",
    			fundingAgencyName: "US GEOLOGICAL SURVEY",
    			naics: {
    				NAICS_Code: 334513,
    				NAICS_Title: "Instruments and Related Products Manufacturing for Measuring, Displaying, and Controlling Industrial Process Variables "
    			},
    			psc: {
    				pscId: 799,
    				pscCode: "6680",
    				pscName: "LIQUID AND GAS FLOW, LIQUID LEVEL, AND MECHANICAL MOTION MEASURING INSTRUMENTS"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "One (1) portable gas fluxmeter",
    			summaryOfProcurement: "The USGS, Volcano Disaster Assistance Program (VDAP)  requires a portable gas fluxmeter to fulfill its Mission. The portable gas fluxmeter monitors and mitigate volcanic hazards. Without this piece of equipment and the capability to monitor gas emissions from numerous volcanoes and hydrothermal systems VDAP) cannot fulfill its mission.",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "The USGS, Volcano Disaster Assistance Program (VDAP)  requires a portable gas fluxmeter to fulfill its Mission. The portable gas fluxmeter monitors and mitigate volcanic hazards. Without this piece of equipment and the capability to monitor gas emissions from numerous volcanoes and hydrothermal systems VDAP) cannot fulfill its mission.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Submitted",
    			ombDetermination: "N/A",
    			countriesOfOriginAndUSContent: [
    			]
    		},
    		state: "submitted",
    		created: "2022-05-06T13:41:36.276Z",
    		modified: "2022-05-06T13:41:36.276Z"
    	},
    	{
    		_id: "62755c31c24cde4e8b44e62e",
    		data: {
    			contractingOfficeAgencyId: "8900",
    			contractingOfficeAgencyName: "ENERGY, DEPARTMENT OF",
    			fundingAgencyId: "8900",
    			fundingAgencyName: "ENERGY, DEPARTMENT OF",
    			naics: {
    				NAICS_Code: 335313,
    				NAICS_Title: "Switchgear and Switchboard Apparatus Manufacturing"
    			},
    			psc: {
    				pscId: 650,
    				pscCode: "5925",
    				pscName: "CIRCUIT BREAKERS"
    			},
    			procurementStage: "Post-solicitation",
    			procurementTitle: "Circuit Breaker IDIQ",
    			summaryOfProcurement: "This IDIQ procurement is to acquire 15.5-KV to 362-KV circuit breakers.  A circuit breaker is an electrical switch designed to protect an electrical circuit from damage caused by overcurrent/overload or short circuit. Its basic function is to interrupt current flow after protective relays detect a fault.  Every substation has multiple circuit breakers.  They are used on transmission lines, transformer lines,  reactor banks, and capacitor banks. ",
    			sourcesSoughtOrRfiIssued: "Yes",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "Yes",
    			waiverCoverage: "Multi-procurement Waiver",
    			waiverRationaleSummary: "A  waiver is requested because of the unavailability of US manufactured end product(s).  ",
    			expectedMaximumDurationOfTheRequestedWaiver: "Between 3 and 5 years",
    			requestStatus: "Submitted",
    			ombDetermination: "N/A",
    			solicitationId: "89503422QWA000493",
    			countriesOfOriginAndUSContent: [
    			]
    		},
    		state: "submitted",
    		created: "2022-05-06T17:34:41.887Z",
    		modified: "2022-05-06T17:34:41.887Z"
    	},
    	{
    		_id: "627bf0eef614e905e63c72f8",
    		data: {
    			contractingOfficeAgencyId: "1434",
    			contractingOfficeAgencyName: "US GEOLOGICAL SURVEY",
    			fundingAgencyId: "1434",
    			fundingAgencyName: "US GEOLOGICAL SURVEY",
    			naics: {
    				NAICS_Code: 334511,
    				NAICS_Title: "Search, Detection, Navigation, Guidance, Aeronautical, and Nautical System and Instrument Manufacturing "
    			},
    			psc: {
    				pscId: 633,
    				pscCode: "5845",
    				pscName: "UNDERWATER SOUND EQUIPMENT"
    			},
    			procurementStage: "Pre-solicitation",
    			procurementTitle: "Ultra Short Baseline (USBL) Underwater Positioning",
    			summaryOfProcurement: "USGS Great Lakes Science Center seeks to procure an Ultra-Short Baseline (USBL) underwater positioning system with an integrated GPS and motion reference unit, tracking beacons, and software necessary for its operation and configuration. The USBL System must be easily moveable and mounted by a single individual on vessels ranging from 4 to 30 m in length, and the top-side control system(s) must be compact to economize space on smaller vessels. USBL will be used immediately upon receipt in underwater mapping exercises to document gradients in toxic mine wastes affecting fish habitats in Lake Superior.",
    			sourcesSoughtOrRfiIssued: "No",
    			piids: [
    				{
    					piid: ""
    				}
    			],
    			isPricePreferenceIncluded: "No",
    			waiverCoverage: "Individual Waiver",
    			waiverRationaleSummary: "USBL will be used immediately upon receipt in underwater mapping exercises to document gradients in toxic mine wastes affecting fish habitats in Lake Superior. The spatial accuracy of the underwater mapping exercises to be conducted by USGS SCUBA divers is of paramount importance because our results will be used to guide mitigation measures. Preliminary evaluation of error tolerances suggested 0.5% of slant range was an acceptable error. The spatial accuracy of the iXBlue is the only unit we could identify at this price point that satisfies this error value and also meets our other needs for a small form factor and simplicity of use. Failure to acquire this item may result in map products that are of limited utility to our partners for mitigation planning, resulting in both risk of financial waste, and reputational risk for USGS.",
    			expectedMaximumDurationOfTheRequestedWaiver: "Instant Delivery Only",
    			requestStatus: "Submitted",
    			ombDetermination: "N/A",
    			countriesOfOriginAndUSContent: [
    			]
    		},
    		state: "submitted",
    		created: "2022-05-11T17:22:54.084Z",
    		modified: "2022-05-11T17:22:54.084Z"
    	}
    ];

    const waivers = waivers_data.map((d) => {
      return {
        id: d._id,
        title: d.data.procurementTitle,
        summary: d.data.summaryOfProcurement,
        rationale: d.data.waiverRationaleSummary,
      };
    });

    let miniSearch = new MiniSearch({
      fields: ["title", "summary", "rationale"], // fields to index for full-text search
      storeFields: ["title", "summary"], // fields to return with search results
    });

    // Index all documents
    miniSearch.addAll(waivers);

    const searchInput = document.getElementById("search-field");

    const getResults = (e) => {
      e.preventDefault();
      let results = miniSearch.search(searchInput.value);
      filterList(results);
    };

    const filterList = (results) => {
      const children = document.getElementById("waivers").children;
      const ids = results.map((d) => `waiver-${d.id}`);
      if (ids.length === 0) {
        for (var i = 0; i < children.length; i++) {
          children[i].hidden = false;
        }
        return true;
      }

      for (var i = 0; i < children.length; i++) {
        if (!ids.find((e) => e == children[i].id)) {
          children[i].hidden = true;
        } else {
          children[i].hidden = false;
        }
      }
    };

    document.getElementById("waiver-search").addEventListener("submit", getResults);

}));
