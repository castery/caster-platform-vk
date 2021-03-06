import { generateWarningLog } from '../../../caster';

/**
 * Checks message for uniqueness
 *
 * @param {Object} params
 *
 * @return {boolean}
 */
// eslint-disable-next-line import/prefer-default-export
export const isSpecialMessage = params => (
	'attachment' in params
	|| 'forward_messages' in params
	|| 'sticker_id' in params
);

/**
 * Warning log
 *
 * @type {Function}
 */
export const warningLog = generateWarningLog('caster-vk');
