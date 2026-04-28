export class XHRSpy {
  static listeners: Array<(xhr: XMLHttpRequest) => void> = [];
  static originalSend = XMLHttpRequest.prototype.send;
  static replacedSend = (XMLHttpRequest.prototype.send = function (...args) {
    const xhr = this;
    xhr.addEventListener("readystatechange", () =>
      XHRSpy.listeners.forEach((listener) => listener(xhr)),
    );
    return XHRSpy.originalSend.apply(xhr, args);
  });

  static add(pathRegex: RegExp, handler: (json: unknown, url: URL) => void) {
    XHRSpy.listeners.push(function (xhr) {
      if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
        const url = new URL(xhr.responseURL);
        if (url.pathname.match(pathRegex)) {
          let json: unknown;
          try {
            json = JSON.parse(xhr.responseText);
          } catch (err) {}
          try {
            handler(json, url);
          } catch (err) {}
        }
      }
    });
  }
}
