import { VK } from 'vk-io';
import createDebug from 'debug';
import {
	Platform,
	UnsupportedContextTypeError,
	UnsupportedAttachmentTypeError
} from '@castery/caster';

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
			const { isGroup } = this.options;

			this.vk.setOptions({
				limit: isGroup
					? 20
					: 3,
				apiMode: isGroup
					? 'sequential'
					: 'parallel_selected'
			});
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
		if (this.isStarted()) {
			return;
		}

		this.started = true;

		const token = await this.getToken();
		const identifier = await this.getIdentifier();

		this.setOptions({
			id: identifier,
			adapter: { token }
		});

		await this.vk.updates.startPolling();
	}

	/**
	 * @inheritdoc
	 */
	async stop() {
		if (!this.isStarted()) {
			return;
		}

		await this.vk.updates.stop();

		this.started = false;
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
				throw new UnsupportedContextTypeError({
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
						throw new UnsupportedAttachmentTypeError({ type });
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
		this.vk.setCaptchaHandler(({ src, sid }, retry) => {
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
			return this.vk.api.messages.send(params);
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

		const { promise } = message;
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
		const { updates } = this.vk;

		updates.on('message', async (context, next) => {
			if (context.isEvent()) {
				if (context.getEventName() !== 'chat_kick_user') {
					return;
				}

				this.queue.clearByPeer(context.getEventId());

				return;
			}

			if (context.isOutbox()) {
				return;
			}

			let $text = context.getText();

			const { type } = context.getFrom();

			if (type !== 'group' && $text !== null) {
				if (type === 'chat' && !this.hasPrefix.test($text)) {
					return;
				}

				$text = $text.replace(this.replacePrefix, '');
			}

			for (const caster of this.casters) {
				await caster.dispatchIncoming(new VKMessageContext(caster, {
					id: this.options.id,
					context,
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
			const { token: accessToken } = await this.vk.auth.implicitFlowUser().run();

			return accessToken;
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
