'use strict';

import VK from 'vk-io';

import { Platform } from '@castery/caster';

import createDebug from 'debug';

import { Queue } from './queue';

import { VKMessageContext } from './contexts/message';

import {
	PLATFORM_NAME,
	defaultOptions,
	switchUploadType,
	switchAttachments,
	supportAttachments,
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
	getAdapter () {
		return this.vk;
	}

	/**
	 * Returns the platform id
	 *
	 * @return {number}
	 */
	getId () {
		return this.options.id;
	}

	/**
	 * Returns the platform name
	 *
	 * @return {string}
	 */
	getPlatformName () {
		return PLATFORM_NAME;
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
	async subscribe (caster) {
		this._casters.add(caster);

		if (!this.isStarted()) {
			await this.start();
		}

		caster.outcoming.addPlatform(this, async (context, next) => {
			if (context.getPlatformName() !== PLATFORM_NAME) {
				return await next();
			}

			if (context.getPlatformId() !== this.options.id) {
				return await next();
			}

			const message = {
				peer_id: context.to.id,
				message: context.text
			};

			if ('attachments' in context) {
				message.attachment = await Promise.all(
					context.attachments.filter(({ type }) => (
						supportAttachments.includes(type)
					))
					.map((attachment) => {
						let { type } = attachment;

						let uploadType = switchUploadType[type] || type;

						if (type in switchAttachments) {
							type = switchAttachments[type];
						}

						if ('id' in attachment) {
							const { id, owner } = attachment;

							return `${type}${owner}_${id}`;
						}

						return this.vk.upload[uploadType]({
							source: attachment.source
						})
						.tap(console.log)
						.then((uploaded) => {
							if (type === 'video') {
								return `video${uploaded.owner_id}_${uploaded.video_id}`;
							}

							return this.vk.getAttachment(type, uploaded);
						})
						.tap(console.log);
					})
				);

				message.attachment = message.attachment.join(',');
			}

			return await this._send(message);
		});
	}

	/**
	 * @inheritdoc
	 */
	async unsubscribe (caster) {
		this._casters.delete(caster);

		caster.outcoming.removePlatform(this);

		if (this._casters.size === 0 && this.isStarted()) {
			await this.stop();
		}
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
	 * Sends a message
	 *
	 * @param {Object} params
	 *
	 * @return {Promise<mixed>}
	 */
	_send (params) {
		if (this.options.isGroup) {
			return this._vk.api.messages.send(params);
		}

		const promise = this._queue.enqueue(params);

		this._dequeueMessage();

		return promise;
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
				caster.dispatchIncoming(
					new VKMessageContext(caster, message, this.options.id)
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
			await this.vk.api.account.getInfo();

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
