import { MessageContext, contextProps } from '@castery/caster';

import {
	PLATFORM_NAME,
	supportedContextTypes,
	supportedAttachmentTypes
} from '../utils/constants';

const { SUPPORTED_CONTEXT_TYPES, SUPPORTED_ATTACHMENT_TYPES } = contextProps;

/**
 * Incoming vk context
 *
 * @public
 */
export default class VKMessageContext extends MessageContext {
	/**
	 * Constructor
	 *
	 * @param {Caster} caster
	 * @param {Object} payload
	 */
	constructor(caster, { id: idPlatform, context, $text = null }) {
		super(caster);

		this.platform = {
			id: idPlatform,
			name: PLATFORM_NAME
		};

		this.text = context.getText();
		this.$text = $text;

		const { id, type } = context.getFrom();

		this.from = { id, type };

		const user = context.getUserId();

		this.sender = {
			id: user,
			type: type === 'group'
				? 'group'
				: 'user'
		};

		this.raw = context;
	}

	/**
	 * Returns supported context types
	 *
	 * @return {Object}
	 */
	get [SUPPORTED_CONTEXT_TYPES]() {
		return supportedContextTypes;
	}

	/**
	 * Returns supported attachment types
	 *
	 * @return {Object}
	 */
	get [SUPPORTED_ATTACHMENT_TYPES]() {
		return supportedAttachmentTypes;
	}

	/**
	 * Sends a message to the current dialog
	 *
	 * @param {mixed}  text
	 * @param {Object} options
	 *
	 * @return {Promise<mixed>}
	 */
	send(text, options = {}) {
		if (typeof text === 'object') {
			options = text;
		} else {
			options.text = text;
		}

		const context = new VKMessageContext(this.caster, {
			id: this.platform.id,
			context: this.raw
		});

		context.to = this.from;
		context.state = { ...this.state };

		context.text = options.text;

		if ('attachments' in options) {
			if (!Array.isArray(options.attachments)) {
				context.attachments = [options.attachments];
			} else {
				context.attachments = options.attachments;
			}
		}

		return this.caster.dispatchOutcoming(context);
	}

	/**
	 * Responds to a message with a mention
	 *
	 * @param {mixed}  text
	 * @param {Object} options
	 *
	 * @return {Promise<mixed>}
	 */
	reply(text, options = {}) {
		if (typeof text === 'object') {
			options = text;
		} else {
			options.text = text;
		}

		// TODO: Add user name
		options.text = `@id${this.sender.id}, ${options.text}`;

		return this.send(options);
	}
}
