(function () {

window.isomerize = function (obj, dependencies) {
  // if we don't have access to web workers,
  // just run everything in the main thread
  if (!window.Worker) {
    return;
  }

  var code = '';

  for (var i in dependencies) {
    var name = dependencies[i];
    var dep = window[name];
    code += toSource(dep, name);
  }

  code += toSource(obj, 'original');
  code += '(' + isomerExternal.toString() + ')();';

  var blob = new Blob([ code ], { type: 'application/javascript' });
  var worker = new Worker(URL.createObjectURL(blob));
  var listeners = {};

  worker.onmessage = function (e) {
    var data = JSON.parse(e.data);

    if (!listeners[data.time]) {
      return;
    }

    listeners[data.time].apply(listeners[data.time], data.args);
  };

  for (var i in obj) {
    if (typeof obj[i] == 'function') {
      obj[i] = overrideLocalMethod(i);
    }
  }

  function overrideLocalMethod (methodName) {
    return function isomerProxy () {
      var args = [].slice.call(arguments);
      var callback = args.pop();
      var now = +new Date();
      listeners[now] = callback;

      worker.postMessage(JSON.stringify({
        name: methodName,
        time: now,
        args: args
      }));
    }
  }
}

function isomerExternal () {
  onmessage = function (e) {
    var data = JSON.parse(e.data);
    var args = data.args;

    args.push(function () {
      var args = [].slice.call(arguments);
      postMessage(JSON.stringify({
        time: data.time,
        args: args
      }));
    });

    original[data.name].apply(original, args);
  }
}

function toSource (obj, name) {
  var code = '';

  if (name) {
    code += 'var ' + name + ' = ';
  }

  if (typeof obj == 'function') {
    code += obj.toString();
  } else {
    code += JSON.stringify(obj);
  }

  code += ';\n';

  for (var i in obj) {
    if (typeof obj[i] != 'function') {
      continue;
    }

    if (name) {
      code += name + '.' + i + ' = ';
    }

    code += obj[i].toString() + ';\n';
  }

  for (var i in obj.prototype) {
    if (name) {
      code += name + '.prototype.' + i + ' = ';
    }

    if (typeof obj.prototype[i] == 'function') {
      code += obj.prototype[i].toString() + ';\n';
    } else if (typeof obj.prototype[i] == 'object') {
      code += JSON.stringify(obj.prototype[i]) + ';\n';
    }
  }

  return code;
}


})();
