'use strict';

import VK from 'vk-io';

/* TODO: Change from local package to npm */
import { Platform } from '../../caster';

import createDebug from 'debug';

import { Queue } from './queue';

import { VKMessageContext } from './contexts/message';

import {
	PLATFORM,
	defaultOptions,
	defaultOptionsSchema
} from './util/constants';

const debug = createDebug('caster:platform-vk');

/**
 * Platform for integration with social network VK
 *
 * @public
 */
export class VKPlatform extends Platform {
	/**
	 * Constructor
	 *
	 * @param {Object} options
	 */
	constructor (options = {}) {
		super();

		Object.assign(this.options, defaultOptions);

		this.vk = new VK;
		this._queue = new Queue;
		this._casters = new Set;

		this._vk = null;
		this._captchaCount = 0;
		this._queueTimeout = null;

		if (Object.keys(options).length > 0) {
			this.setOptions(options);
		}

		this._addDefaultEvents();
	}

	/**
	 * @inheritdoc
	 */
	setOptions (options) {
		super.setOptions(options);

		if ('adapter' in options) {
			this.vk.setOptions(this.options.adapter);
		}

		if ('isGroup' in options) {
			if (this.options.isGroup && this._vk === null) {
				this._vk = new VK(
					this.options.adapter
				);

				this._vk.setOptions({
					call: 'execute'
				});
			} else if (!this.options.isGroup) {
				this._vk = null;
			}
		}

		return this;
	}

	/**
	 * @inheritdoc
	 */
	getOptionsSchema () {
		return defaultOptionsSchema;
	}

	/**
	 * @inheritdoc
	 */
	async start () {
		const token = await this._getToken();
		const identifier = await this._getIdentifier();

		this.setOptions({
			id: identifier,
			adapter: { token }
		});

		await this.vk.longpoll.start();
	}

	/**
	 * @inheritdoc
	 */
	async stop () {
		await this.vk.longpoll.stop();
	}

	/**
	 * @inheritdoc
	 */
	subscribe (caster) {
		this._casters.add(caster);
	}

	/**
	 * @inheritdoc
	 */
	unsubscribe (caster) {
		this._casters.delete(caster);
	}

	/**
	 * Sends a message
	 *
	 * @param {Object} params
	 *
	 * @return {Promise<mixed>}
	 */
	send (params) {
		if ('text' in params) {
			params.message = params.text;
			delete params.text;
		}

		params.peer_id = params._from.id;
		delete params._from;

		if (this.options.isGroup) {
			return this._vk.api.messages.send(params);
		}

		const promise = this._queue.enqueue(params);

		this._dequeueMessage();

		return promise;
	}

	/**
	 * Set captcha handler
	 *
	 * @param {function} handler
	 *
	 * @return {this}
	 */
	setCaptchaHandler (handler) {
		this.vk.setCaptchaHandler((src, sid, retry) => {
			this._captchaCount += 1;

			this._clearQueueTimeout();

			handler(src, sid, (key) => (
				retry(key)
				.then(() => {
					this._captchaCount -= 1;

					debug('Captcha success');

					this._clearQueueTimeout();
					this._dequeueMessage();
				})
				.catch((error) => {
					this._captchaCount -= 1;

					debug('Captcha fail');

					throw error;
				})
			));
		});
	}

	/**
	 * Checks for availability of captcha
	 *
	 * @return {boolean}
	 */
	hasCaptcha () {
		return this._captchaCount > 0;
	}

	/**
	 * Returns the number of captcha
	 *
	 * @return {number}
	 */
	getCaptchaCount () {
		return this._captchaCount;
	}

	/**
	 * Starts the queue
	 * TODO: Make a more versatile option
	 */
	_dequeueMessage () {
		if (this._queueTimeout !== null || this._queue.isEmpty()) {
			return;
		}

		if (this.hasCaptcha()) {
			return this._clearQueueTimeout();
		}

		const message = this._queue.dequeue();

		const { _promise: promise } = message;
		delete message._promise;

		this._queueTimeout = setTimeout(() => {
			this._clearQueueTimeout();

			this._dequeueMessage();
		}, this.options.sendingInterval);

		this.vk.api.messages.send(message)
		.then((response) => {
			for (const resolve of promise.resolve) {
				resolve(response);
			}
		})
		.catch((error) => {
			for (const reject of promise.reject) {
				reject(error);
			}
		});
	}

	/**
	 * Clear queue timeout
	 */
	_clearQueueTimeout () {
		clearTimeout(this._queueTimeout);

		this._queueTimeout = null;
	}

	/**
	 * Add default events vk
	 */
	_addDefaultEvents () {
		const longpoll = this.vk.longpoll;

		longpoll.on('chat.kick', (action) => {
			if (this.vk.options.id === action.kick) {
				this._queue.clearByPeer(action.peer);
			}
		});

		longpoll.on('message', (message) => {
			/* Skip messages sent by bot or user manually */
			if (message.from === 'group' && message.hasFlag('answered')) {
				return;
			} else if (message.hasFlag('outbox')) {
				return;
			}

			for (const caster of this._casters) {
				caster.dispatchIncomingMiddleware(
					new VKMessageContext(this, caster, message)
				);
			}
		});
	}

	/**
	 * Returns the token
	 *
	 * @return {Promise<string>}
	 */
	async _getToken () {
		const { token } = this.options.adapter;

		if (this.options.isGroup) {
			if (typeof token !== 'string') {
				throw new Error('Missing group token');
			}

			return token;
		}

		try {
			/* HACK: Check valid user token */
			await this.vk.api.account.getUserInfo();

			return token;
		} catch (e) {
			return await this.vk.auth.standalone().run();
		}
	}

	/**
	 * Returns the identifier
	 *
	 * @return {Promise<number>}
	 */
	async _getIdentifier () {
		const { id } = this.options;

		if (id !== null) {
			return id;
		}

		const [{ id: userId }] = await this.vk.api.users.get();

		return userId;
	}
}
