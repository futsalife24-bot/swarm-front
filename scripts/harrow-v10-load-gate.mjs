export class LatestRequest {
  #id = 0;

  begin(version) {
    return Object.freeze({id: ++this.#id, version});
  }

  isCurrent(request) {
    return request.id === this.#id;
  }
}
