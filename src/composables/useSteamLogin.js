/**
 * Composable for Steam OpenID login.
 * Centralizes the loginWithSteam redirect logic used in NavBar, HomeView, and ProfileEditView.
 */
export function useSteamLogin() {
	const loginWithSteam = (returnHash = '') => {
		const baseUrl = window.location.href.split('#')[0]
		const returnUrl = returnHash ? baseUrl + returnHash : baseUrl
		const realm = window.location.origin

		const params = new URLSearchParams({
			'openid.ns': 'http://specs.openid.net/auth/2.0',
			'openid.mode': 'checkid_setup',
			'openid.return_to': returnUrl,
			'openid.realm': realm,
			'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
			'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
		})

		window.location.href = `https://steamcommunity.com/openid/login?${params.toString()}`
	}

	return {loginWithSteam}
}

