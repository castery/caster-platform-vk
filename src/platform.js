import createDebug from 'debug';
import {
	Platform,
	UnsupportedContextType,
	UnsupportedAttachmentType
} from '@castery/caster';

import VK from '../../vk-io@4.0.0';

import Queue from './queue';
import VKMessageContext from './contexts/message';

import {
	PLATFORM_NAME,
	defaultOptions,
	switchAttachments,
	switchUploadMethod,
	defaultOptionsSchema,
	supportedContextTypes,
	supportedAttachmentTypes
} from './util/constants';

const debug = createDebug('caster-vk');

/**
 * Platform for integration with social network VK
 *
 * @public
 */
export default class VKPlatform extends Platform {
	/**
	 * Constructor
	 *
	 * @param {Object} options
	 */
	constructor(options = {}) {
		super();

		Object.assign(this.options, defaultOptions);

		this.vk = new VK();
		this.queue = new Queue();
		this.casters = new Set();

		this.group = null;
		this.captchaCount = 0;
		this.queueTimeout = null;

		if (Object.keys(options).length > 0) {
			this.setOptions(options);
		}

		this.setReplacePrefix();
		this.addDefaultEvents();
	}

	/**
	 * @inheritdoc
	 */
	setOptions(options) {
		super.setOptions(options);

		if ('adapter' in options) {
			this.vk.setOptions(this.options.adapter);
		}

		if ('isGroup' in options) {
			if (this.options.isGroup && this.group === null) {
				this.group = new VK(this.options.adapter);

				this.group.setOptions({
					call: 'execute'
				});
			} else if (!this.options.isGroup) {
				this.group = null;
			}
		}

		if ('prefix' in options) {
			this.setReplacePrefix();
		}

		return this;
	}

	/**
	 * @inheritdoc
	 */
	getOptionsSchema() {
		return defaultOptionsSchema;
	}

	/**
	 * @inheritdoc
	 */
	getAdapter() {
		return this.vk;
	}

	/**
	 * Returns the platform id
	 *
	 * @return {number}
	 */
	getId() {
		return this.options.id;
	}

	/**
	 * Returns the platform name
	 *
	 * @return {string}
	 */
	getPlatformName() {
		return PLATFORM_NAME;
	}

	/**
	 * @inheritdoc
	 */
	async start() {
		const token = await this.getToken();
		const identifier = await this.getIdentifier();

		this.setOptions({
			id: identifier,
			adapter: { token }
		});

		await this.vk.longpoll.start();
	}

	/**
	 * @inheritdoc
	 */
	async stop() {
		await this.vk.longpoll.stop();
	}

	/**
	 * @inheritdoc
	 */
	async subscribe(caster) {
		this.casters.add(caster);

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

			if (supportedContextTypes[context.type] !== true) {
				throw new UnsupportedContextType({
					type: context.type
				});
			}

			const message = {
				peer_id: context.to.id,
				message: context.text
			};

			if ('attachments' in context) {
				for (const { type } of context.attachments) {
					if (supportedAttachmentTypes[type] !== true) {
						throw new UnsupportedAttachmentType({ type });
					}
				}

				const attachments = await Promise.all(context.attachments.map((attachment) => {
					let { type } = attachment;
					const uploadMethod = switchUploadMethod[type] || type;

					if (type in switchAttachments) {
						// eslint-disable-next-line prefer-destructuring
						type = switchAttachments[type];
					}

					if ('id' in attachment) {
						const { id, owner } = attachment;

						return `${type}${owner}_${id}`;
					}

					return this.vk.upload[uploadMethod]({
						source: attachment.source
					})
						.then((uploaded) => {
							if (type === 'video') {
								return `video${uploaded.owner_id}_${uploaded.video_id}`;
							}

							return this.vk.getAttachment(type, uploaded);
						});
				}));

				message.attachment = attachments.join(',');
			}

			return await this.send(message);
		});
	}

	/**
	 * @inheritdoc
	 */
	async unsubscribe(caster) {
		this.casters.delete(caster);

		caster.outcoming.removePlatform(this);

		if (this.casters.size === 0 && this.isStarted()) {
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
	setCaptchaHandler(handler) {
		this.vk.setCaptchaHandler((src, sid, retry) => {
			this.captchaCount += 1;

			this.clearQueueTimeout();

			handler(src, sid, key => (
				retry(key)
					.then(() => {
						this.captchaCount -= 1;

						debug('Captcha success');

						this.clearQueueTimeout();
						this.dequeueMessage();
					})
					.catch((error) => {
						this.captchaCount -= 1;

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
	hasCaptcha() {
		return this.captchaCount > 0;
	}

	/**
	 * Returns the number of captcha
	 *
	 * @return {number}
	 */
	getCaptchaCount() {
		return this.captchaCount;
	}

	/**
	 * Sends a message
	 *
	 * @param {Object} params
	 *
	 * @return {Promise<mixed>}
	 */
	send(params) {
		if (this.options.isGroup) {
			return this.group.api.messages.send(params);
		}

		const promise = this.queue.enqueue(params);

		this.dequeueMessage();

		return promise;
	}

	/**
	 * Starts the queue
	 * TODO: Make a more versatile option
	 */
	dequeueMessage() {
		if (this.queueTimeout !== null || this.queue.isEmpty()) {
			return;
		}

		if (this.hasCaptcha()) {
			this.clearQueueTimeout();

			return;
		}

		const message = this.queue.dequeue();

		const { _promise: promise } = message;
		delete message.promise;

		this.queueTimeout = setTimeout(() => {
			this.clearQueueTimeout();

			this.dequeueMessage();
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
	clearQueueTimeout() {
		clearTimeout(this.queueTimeout);

		this.queueTimeout = null;
	}

	/**
	 * Add default events vk
	 */
	addDefaultEvents() {
		const { longpoll } = this.vk;

		longpoll.on('chat.kick', (action) => {
			if (this.vk.options.id === action.kick) {
				this.queue.clearByPeer(action.peer);
			}
		});

		longpoll.on('message', (message) => {
			/* Skip messages sent by bot or user manually */
			if (message.from === 'group' && message.hasFlag('answered')) {
				return;
			} else if (message.hasFlag('outbox')) {
				return;
			}

			let $text = message.text;

			if (message.from !== 'group' && $text !== null) {
				if (message.from === 'chat' && !this.hasPrefix.test($text)) {
					return;
				}

				$text = $text.replace(this.replacePrefix, '');
			}

			for (const caster of this.casters) {
				caster.dispatchIncoming(new VKMessageContext(caster, {
					id: this.options.id,
					message,
					$text
				}));
			}
		});
	}

	/**
	 * Returns the token
	 *
	 * @return {Promise<string>}
	 */
	async getToken() {
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
		} catch (error) {
			return await this.vk.auth.standalone().run();
		}
	}

	/**
	 * Returns the identifier
	 *
	 * @return {Promise<number>}
	 */
	async getIdentifier() {
		const { id } = this.options;

		if (id !== null) {
			return id;
		}

		const [{ id: userId }] = await this.vk.api.users.get();

		return userId;
	}

	/**
	 * Sets replace prefix
	 */
	setReplacePrefix() {
		let { prefix } = this.options;

		prefix = String.raw`^(?:${prefix.join('|')})`;

		this.hasPrefix = new RegExp(
			String.raw`${prefix}.+`,
			'i'
		);
		this.replacePrefix = new RegExp(
			String.raw`${prefix}?[, ]*`,
			'i'
		);
	}
}
