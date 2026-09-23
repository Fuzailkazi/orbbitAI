/**
 * JavaScript source evaluated INSIDE the sandbox's vm context before the candidate code.
 *
 * It is plain source text (not host functions) on purpose: passing any host-realm object into
 * the context would hand candidate code a path back to the host `Function` constructor (the
 * classic `obj.constructor.constructor("return process")()` escape). Everything the tests need
 * is therefore built from the context's own intrinsics:
 *
 *   - `require(name)`: returns the assert shim for "assert" / "node:assert" ONLY (MultiPL-E JS
 *     tests start with `const assert = require('node:assert');`); every other module throws.
 *   - an `assert` shim mirroring node:assert semantics for ok, equal, notEqual, strictEqual,
 *     notStrictEqual, deepEqual, notDeepEqual, deepStrictEqual, notDeepStrictEqual, throws, fail.
 *     deepEqual follows Node's *legacy* (loose) rules — primitives compared with `==`, NaN equals
 *     NaN, prototypes ignored — because MultiPL-E's tests use `assert.deepEqual`.
 *   - `module` / `exports` placeholders and a no-op `console`.
 *
 * `require` is installed as a non-writable, non-configurable global, and the intrinsics the shim
 * relies on are captured up front, so candidate code cannot trivially swap the assertions out.
 */
export const ASSERT_SHIM_SOURCE = String.raw`
(function (g) {
  "use strict";
  var objectKeys = Object.keys;
  var objectIs = Object.is;
  var getProto = Object.getPrototypeOf;
  var defineProperty = Object.defineProperty;
  var freeze = Object.freeze;
  var isArray = Array.isArray;
  var toTag = Function.prototype.call.bind(Object.prototype.toString);
  var isEnumerable = Function.prototype.call.bind(Object.prototype.propertyIsEnumerable);
  var jsonStringify = JSON.stringify;
  var StringCtor = String;
  var ErrorCtor = Error;
  var TypeErrorCtor = TypeError;
  var DateCtor = Date;
  var RegExpCtor = RegExp;
  var MapCtor = Map;
  var SetCtor = Set;
  var NumberCtor = Number;
  var BooleanCtor = Boolean;
  var mapEntries = Function.prototype.call.bind(Map.prototype.entries);
  var mapHas = Function.prototype.call.bind(Map.prototype.has);
  var mapGet = Function.prototype.call.bind(Map.prototype.get);
  var setValues = Function.prototype.call.bind(Set.prototype.values);
  var setHas = Function.prototype.call.bind(Set.prototype.has);
  var dateTime = Function.prototype.call.bind(Date.prototype.getTime);

  function AssertionError(message) {
    var err = new ErrorCtor(message);
    err.name = "AssertionError";
    err.code = "ERR_ASSERTION";
    return err;
  }

  function inspect(value, depth, seen) {
    var t = typeof value;
    if (t === "string") return jsonStringify(value.length > 200 ? value.slice(0, 200) + "..." : value);
    if (t === "number") return objectIs(value, -0) ? "-0" : StringCtor(value);
    if (t === "bigint") return StringCtor(value) + "n";
    if (t === "symbol") return "Symbol()";
    if (t === "function") return "[Function" + (value.name ? ": " + value.name : "") + "]";
    if (value === null || t !== "object") return StringCtor(value);
    for (var s = 0; s < seen.length; s++) if (seen[s] === value) return "[Circular]";
    if (depth > 3) return isArray(value) ? "[Array]" : "[Object]";
    seen.push(value);
    var parts = [];
    var out;
    if (isArray(value)) {
      for (var i = 0; i < value.length && i < 30; i++) parts.push(inspect(value[i], depth + 1, seen));
      if (value.length > 30) parts.push("...");
      out = "[" + parts.join(", ") + "]";
    } else {
      var keys = objectKeys(value);
      for (var k = 0; k < keys.length && k < 30; k++) {
        parts.push(jsonStringify(keys[k]) + ": " + inspect(value[keys[k]], depth + 1, seen));
      }
      if (keys.length > 30) parts.push("...");
      out = "{" + parts.join(", ") + "}";
    }
    seen.pop();
    return out;
  }

  function show(value) {
    var text;
    try { text = inspect(value, 0, []); } catch (e) { text = "[uninspectable]"; }
    return text.length > 300 ? text.slice(0, 300) + "..." : text;
  }

  function fail(message, fallback) {
    if (message instanceof ErrorCtor) throw message;
    throw AssertionError(message !== undefined ? StringCtor(message) : fallback);
  }

  function isObj(v) { return v !== null && typeof v === "object"; }

  function looseEqual(a, b) {
    return a == b || (a !== a && b !== b);
  }

  function keysEqual(a, b, strict, memo) {
    var ka = objectKeys(a);
    var kb = objectKeys(b);
    if (ka.length !== kb.length) return false;
    for (var i = 0; i < ka.length; i++) {
      if (!isEnumerable(b, ka[i])) return false;
      if (!deepEqual(a[ka[i]], b[ka[i]], strict, memo)) return false;
    }
    return true;
  }

  function setEqual(a, b, strict, memo) {
    if (a.size !== b.size) return false;
    var pending = [];
    var it = setValues(a);
    for (var step = it.next(); !step.done; step = it.next()) {
      var v = step.value;
      if (setHas(b, v)) continue;
      if (strict && !isObj(v)) return false;
      pending.push(v);
    }
    if (pending.length === 0) return true;
    var candidates = [];
    var itb = setValues(b);
    for (var sb = itb.next(); !sb.done; sb = itb.next()) {
      if (!setHas(a, sb.value)) candidates.push(sb.value);
    }
    for (var p = 0; p < pending.length; p++) {
      var found = -1;
      for (var c = 0; c < candidates.length; c++) {
        if (deepEqual(pending[p], candidates[c], strict, memo)) { found = c; break; }
      }
      if (found < 0) return false;
      candidates.splice(found, 1);
    }
    return true;
  }

  function mapEqual(a, b, strict, memo) {
    if (a.size !== b.size) return false;
    var it = mapEntries(a);
    for (var step = it.next(); !step.done; step = it.next()) {
      var key = step.value[0];
      var val = step.value[1];
      if (mapHas(b, key)) {
        if (!deepEqual(val, mapGet(b, key), strict, memo)) return false;
        continue;
      }
      var matched = false;
      var itb = mapEntries(b);
      for (var sb = itb.next(); !sb.done; sb = itb.next()) {
        if (deepEqual(key, sb.value[0], strict, memo) && deepEqual(val, sb.value[1], strict, memo)) {
          matched = true;
          break;
        }
      }
      if (!matched) return false;
    }
    return true;
  }

  function deepEqual(a, b, strict, memo) {
    if (a === b) return a !== 0 || objectIs(a, b) || !strict;
    if (strict) {
      if (typeof a !== "object") return typeof a === "number" && a !== a && b !== b;
      if (typeof b !== "object" || a === null || b === null) return false;
      if (getProto(a) !== getProto(b)) return false;
    } else {
      if (!isObj(a)) return isObj(b) ? false : looseEqual(a, b);
      if (!isObj(b)) return false;
    }
    if (toTag(a) !== toTag(b)) return false;
    if (isArray(a) !== isArray(b)) return false;
    if (isArray(a) && a.length !== b.length) return false;
    if (a instanceof DateCtor) {
      if (dateTime(a) !== dateTime(b)) return false;
    } else if (a instanceof RegExpCtor) {
      if (StringCtor(a) !== StringCtor(b)) return false;
    } else if (a instanceof NumberCtor || a instanceof StringCtor || a instanceof BooleanCtor) {
      if (!objectIs(a.valueOf(), b.valueOf())) return false;
    } else if (a instanceof ErrorCtor) {
      if (a.message !== b.message || a.name !== b.name) return false;
    }
    for (var m = 0; m < memo.length; m++) {
      if (memo[m][0] === a && memo[m][1] === b) return true;
    }
    memo.push([a, b]);
    var result;
    if (a instanceof MapCtor) result = b instanceof MapCtor && mapEqual(a, b, strict, memo) && keysEqual(a, b, strict, memo);
    else if (a instanceof SetCtor) result = b instanceof SetCtor && setEqual(a, b, strict, memo) && keysEqual(a, b, strict, memo);
    else result = keysEqual(a, b, strict, memo);
    memo.pop();
    return result;
  }

  function ok(value, message) {
    if (!value) fail(message, "The expression evaluated to a falsy value: " + show(value));
  }

  var assert = function assert(value, message) { ok(value, message); };
  assert.ok = ok;
  assert.fail = function (message) { fail(message, "Failed"); };
  assert.equal = function (actual, expected, message) {
    if (!looseEqual(actual, expected)) fail(message, show(actual) + " == " + show(expected));
  };
  assert.notEqual = function (actual, expected, message) {
    if (looseEqual(actual, expected)) fail(message, show(actual) + " != " + show(expected));
  };
  assert.strictEqual = function (actual, expected, message) {
    if (!objectIs(actual, expected)) {
      fail(message, "Expected values to be strictly equal: actual " + show(actual) + ", expected " + show(expected));
    }
  };
  assert.notStrictEqual = function (actual, expected, message) {
    if (objectIs(actual, expected)) fail(message, "Expected values to be strictly unequal: " + show(actual));
  };
  assert.deepEqual = function (actual, expected, message) {
    if (!deepEqual(actual, expected, false, [])) {
      fail(message, "Expected values to be loosely deep-equal: actual " + show(actual) + ", expected " + show(expected));
    }
  };
  assert.notDeepEqual = function (actual, expected, message) {
    if (deepEqual(actual, expected, false, [])) fail(message, "Expected values not to be loosely deep-equal: " + show(actual));
  };
  assert.deepStrictEqual = function (actual, expected, message) {
    if (!deepEqual(actual, expected, true, [])) {
      fail(message, "Expected values to be strictly deep-equal: actual " + show(actual) + ", expected " + show(expected));
    }
  };
  assert.notDeepStrictEqual = function (actual, expected, message) {
    if (deepEqual(actual, expected, true, [])) fail(message, "Expected values not to be strictly deep-equal: " + show(actual));
  };
  assert.throws = function (fn, expected, message) {
    if (typeof fn !== "function") throw new TypeErrorCtor("The \"fn\" argument must be of type function.");
    if (typeof expected === "string") { message = expected; expected = undefined; }
    var threw = false;
    var error;
    try { fn(); } catch (e) { threw = true; error = e; }
    if (!threw) fail(message, "Missing expected exception.");
    if (expected === undefined) return;
    if (expected instanceof RegExpCtor) {
      if (!expected.test(StringCtor(error))) fail(message, "The error did not match the expected pattern.");
      return;
    }
    if (typeof expected === "function") {
      if (expected.prototype !== undefined && error instanceof expected) return;
      if (expected === ErrorCtor || ErrorCtor.isPrototypeOf(expected)) fail(message, "The error is not an instance of the expected type.");
      if (expected.call({}, error) === true) return;
      fail(message, "The error validation function did not return true.");
    }
    if (isObj(expected)) {
      var keys = objectKeys(expected);
      for (var i = 0; i < keys.length; i++) {
        var actualValue = isObj(error) || typeof error === "function" ? error[keys[i]] : undefined;
        var expectedValue = expected[keys[i]];
        if (expectedValue instanceof RegExpCtor && typeof actualValue === "string") {
          if (!expectedValue.test(actualValue)) fail(message, "Error property " + keys[i] + " did not match.");
        } else if (!deepEqual(actualValue, expectedValue, true, [])) {
          fail(message, "Error property " + keys[i] + " did not match.");
        }
      }
    }
  };
  assert.AssertionError = AssertionError;
  assert.strict = freeze({
    ok: ok,
    fail: assert.fail,
    equal: assert.strictEqual,
    notEqual: assert.notStrictEqual,
    strictEqual: assert.strictEqual,
    notStrictEqual: assert.notStrictEqual,
    deepEqual: assert.deepStrictEqual,
    notDeepEqual: assert.notDeepStrictEqual,
    deepStrictEqual: assert.deepStrictEqual,
    notDeepStrictEqual: assert.notDeepStrictEqual,
    throws: assert.throws
  });
  freeze(assert);

  function sandboxRequire(name) {
    if (name === "assert" || name === "node:assert") return assert;
    throw new ErrorCtor("Cannot find module '" + StringCtor(name) + "': modules are not available in the Orbbit sandbox.");
  }
  freeze(sandboxRequire);

  defineProperty(g, "require", { value: sandboxRequire, writable: false, configurable: false, enumerable: false });
  var noop = function () {};
  g.console = { log: noop, info: noop, warn: noop, error: noop, debug: noop, trace: noop, dir: noop, table: noop };
  g.module = { exports: {} };
  g.exports = g.module.exports;
})(globalThis);
`;
