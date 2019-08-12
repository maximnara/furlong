"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Redis = void 0;

var redis = _interopRequireWildcard(require("redis"));

var _bluebird = _interopRequireDefault(require("bluebird"));

let connection = null;
let messageInProgress = null;

class Redis {
  constructor(config) {
    this.connect(config);
  }

  connect(config) {
    config = config || {};
    const uri = process.env.REDIS_URI || config.uri;
    const host = process.env.REDIS_HOST || config.host;
    const user = process.env.REDIS_USER || config.user;
    const password = process.env.REDIS_PASSWORD || config.password;
    const port = process.env.REDIS_PORT || config.port;

    if (!uri && !host && !port || host && !port || !host && port) {
      throw new Error('Redis cannot be configured, set uri or port, host.');
    }

    if (uri && uri.length) {
      this.connection = _bluebird.default.promisifyAll(Redis.getRedis().createClient(uri));
      return connection;
    }

    let optional = {};

    if (user && user.length) {
      optional.user = user;
    }

    if (password && password.length) {
      optional.password = password;
    }

    this.connection = _bluebird.default.promisifyAll(Redis.getRedis().createClient(port, host, optional));
  }

  static getRedis() {
    return redis;
  }

  encodeMessage(queue, message) {
    return {
      queue,
      retries: 0,
      data: message
    };
  }

  decodeMessage(message) {
    if (!message) {
      return null;
    }

    if (!message.data) {
      throw new Error('Message not original. Try to send messages via .addMessage() function.');
    }

    return message.data;
  }

  addRetry(message) {
    if (!message.retries) {
      message.retries = 0;
    }

    message.retries = message.retries + 1;
    return message;
  }

  getKey() {
    return this.name;
  }

  getFailedKey() {
    return this.name + '.Failed';
  }

  async addMessage(queue, message) {
    let encodedMessage = this.encodeMessage(queue, message);
    return await this.connection.saddAsync(queue, JSON.stringify(encodedMessage));
  }

  async getMessage(queue) {
    let message = await this.connection.spopAsync(queue);

    if (message) {
      message = JSON.parse(message);
    }

    messageInProgress = message;
    return this.decodeMessage(message);
  }

  async commitMessage() {}

  async failMessage(numberOfRetries) {
    let message = this.addRetry(messageInProgress);
    let key = this.getKey();

    if (message.retries >= numberOfRetries) {
      key = this.getFailedKey();
    }

    await this.connection.saddAsync(message.queue, JSON.stringify(message));
    messageInProgress = null;
  }

}

exports.Redis = Redis;