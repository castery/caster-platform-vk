'use strict';

/**
 * Checks message for uniqueness
 *
 * @param {Object} params
 *
 * @return {boolean}
 */
export const isSpecialMessage = (params) => (
	'attachment' in params
	|| 'forward_messages' in params
	|| 'sticker_id' in params
);
