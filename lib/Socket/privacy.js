import { executeWMexQuery } from './mex.js'

/**
 * MEX query IDs for privacy, status/profile, account/auth, and misc operations.
 * Source: assets/whatsapp-android-mex_client_persist_ids.json
 */
const PRIVACY_MEX_IDS = {
  // Privacy settings
  GET_SETTINGS: '32774292262215380', // GetPrivacySettingsQuery
  SET_SETTING: '26887749497493184', // SetPrivacySettingMutation
  UPDATE_CONTACT_LIST: '26375158178762800', // UpdatePrivacyContactListMutation
  GET_CONTACT_LIST: '25700444246275824', // GetPrivacyContactListQuery
  // Status / profile
  UPDATE_TEXT_STATUS: '25863197129975892', // UpdateTextStatus
  GET_TEXT_STATUS_LIST: '25741205615468936', // GetTextStatusList
  UPDATE_USER_STATUS: '7452341274886724', // UpdateUserStatus
  FETCH_USER_PICTURE: '24983561624604410', // FetchUserPictureInfo
  PROFILE_PICTURE_MUTATION: '24714239711610700', // ProfilePictureMutation
  // Account / auth
  ACCOUNT_LOGIN: '27298465499757130', // AccountLoginMutation
  ACCOUNT_LOGOUT: '26863447609979190', // AccountLogoutMutation
  MULTI_ACCOUNT_REVOKE: '25846242091639660', // MultiAccountRevokeAccount
  ADD_MULTI_ACCOUNT_LINK: '25502812266025190', // AddMultiAccountLink
  ADD_TRUSTED_DEVICE: '24522952587403290', // AddTrustedDeviceMutation
  GET_TRUSTED_DEVICES: '25123358920671964', // GetTrustedDevicesQuery
  UNTRUST_TRUSTED_DEVICE: '26574930682133620', // UntrustTrustedDeviceMutation
  DELETE_TRUSTED_DEVICE: '33867503889559536', // DeleteTrustedDeviceMutation
  // Misc
  MOBILE_CONFIG_FETCH: '25676911271914596', // MobileConfigFetchQuery
  NOTIFY_PUSH_NAME: '25900490552974544', // NotifyPushName
  CONTACT_INTEGRITY: '25924358997169496', // ContactIntegrityQuery
  BIZ_INTEGRITY: '25975613018777536', // BizIntegrityQuery
  LINKED_PROFILES_SET: '25013968611531010', // LinkedProfilesSet
  LINKED_PROFILES_REMOVE: '24537675509265524', // LinkedProfilesRemove
  LINKED_PROFILES_UPDATE: '24876967165297616', // LinkedProfilesUpdate
  MIGRATE_BLOCKLIST_LID: '25028600226770430', // MigrateBlocklistLid
  QR_CODE_SCAN: '26287165600869744' // QRCodeScan
}

export const makePrivacySocket = sock => {
  const { query, generateMessageTag } = sock

  const mexQuery = (variables, queryId, dataPath) =>
    executeWMexQuery(variables, queryId, dataPath, query, generateMessageTag)

  // ── Privacy Settings ────────────────────────────────────────────────────

  /**
   * Fetch all privacy settings via MEX.
   */
  const getPrivacySettings = (jid, features = null) => {
    const users = [{ jid, ...(features ? { privacy_features: features } : {}) }]
    return mexQuery({ users }, PRIVACY_MEX_IDS.GET_SETTINGS, 'xwa2_fetch_wa_users')
  }

  /**
   * Set a privacy setting via MEX.
   * Features: "LAST_SEEN", "ONLINE", "PROFILE_PHOTO", "STATUS", "READ_RECEIPTS", "GROUPS", "CALLS", "SCREENSHOT", "LIVE_LOCATION"
   * Settings: "ALL", "CONTACTS", "CONTACT_BLACKLIST", "NONE"
   */
  const setPrivacySetting = (feature, setting) =>
    mexQuery({ feature, setting }, PRIVACY_MEX_IDS.SET_SETTING, 'xwa2_privacy_feature_update')

  /**
   * Update the contact list for a privacy setting.
   */
  const updatePrivacyContactList = (feature, setting, jids) =>
    mexQuery(
      { feature, setting, contacts: jids.map(jid => ({ jid })) },
      PRIVACY_MEX_IDS.UPDATE_CONTACT_LIST,
      'xwa2_privacy_contact_list_update'
    )

  /**
   * Fetch the contact list for a privacy setting.
   */
  const getPrivacyContactList = (feature, setting) =>
    mexQuery({ feature, setting }, PRIVACY_MEX_IDS.GET_CONTACT_LIST, 'xwa2_privacy_contact_list')

  // ── Status / Profile ───────────────────────────────────────────────────

  /**
   * Update own text status About via MEX.
   */
  const updateTextStatus = (text, emoji = null) => {
    const input = { text }
    if (emoji) input.emoji = { content: emoji }
    return mexQuery({ text_status_input: input }, PRIVACY_MEX_IDS.UPDATE_TEXT_STATUS, 'xwa2_text_status_update')
  }

  /**
   * Fetch text statuses About for a list of JIDs via MEX.
   */
  const getTextStatusList = (jids, lastUpdateTime = null) => {
    const input = jids.map(jid => ({ jid, last_update_time: lastUpdateTime }))
    return mexQuery({ input }, PRIVACY_MEX_IDS.GET_TEXT_STATUS_LIST, 'xwa2_text_status_list')
  }

  /**
   * Update own user status string via MEX.
   */
  const updateUserStatus = status =>
    mexQuery({ status }, PRIVACY_MEX_IDS.UPDATE_USER_STATUS, 'xwa2_update_user_status')

  /**
   * Fetch picture info for a user via MEX.
   */
  const fetchUserPictureInfo = jid =>
    mexQuery({ jid }, PRIVACY_MEX_IDS.FETCH_USER_PICTURE, 'xwa2_fetch_user_picture_info')

  /**
   * Set own profile picture via MEX.
   */
  const setProfilePictureMex = (imageBase64, type = 'image') =>
    mexQuery(
      { input: { image: imageBase64, type } },
      PRIVACY_MEX_IDS.PROFILE_PICTURE_MUTATION,
      'xwa2_profile_picture_mutation'
    )

  // ── Account / Auth ─────────────────────────────────────────────────────

  /**
   * Mark account as logged-in via MEX.
   */
  const accountLogin = phoneNumber =>
    mexQuery({ input: { phone_number: phoneNumber } }, PRIVACY_MEX_IDS.ACCOUNT_LOGIN, 'xwa2_account_login')

  /**
   * Mark account as logged-out via MEX.
   */
  const accountLogout = (phoneNumber, enabledBiometric = false) =>
    mexQuery(
      { input: { phone_number: phoneNumber, enabled_biometric: enabledBiometric } },
      PRIVACY_MEX_IDS.ACCOUNT_LOGOUT,
      'xwa2_account_logout'
    )

  /**
   * Add a multi-account link via MEX.
   */
  const addMultiAccountLink = phoneNumber =>
    mexQuery(
      { input: { phone_number: phoneNumber } },
      PRIVACY_MEX_IDS.ADD_MULTI_ACCOUNT_LINK,
      'xwa2_add_multi_account_link'
    )

  /**
   * Add a trusted device via MEX.
   */
  const addTrustedDevice = (deviceId, deviceName) =>
    mexQuery({ device_id: deviceId, device_name: deviceName }, PRIVACY_MEX_IDS.ADD_TRUSTED_DEVICE, 'xwa2_add_trusted_device')

  /**
   * Fetch list of trusted devices for the account via MEX.
   */
  const getTrustedDevices = () => mexQuery({}, PRIVACY_MEX_IDS.GET_TRUSTED_DEVICES, 'xwa2_get_trusted_devices')

  /**
   * Untrust a trusted device via MEX.
   */
  const untrustTrustedDevice = (deviceId, reason = 'USER_INITIATED') =>
    mexQuery(
      { device_id: deviceId, reason },
      PRIVACY_MEX_IDS.UNTRUST_TRUSTED_DEVICE,
      'xwa2_untrust_trusted_device'
    )

  /**
   * Delete a trusted device entirely via MEX.
   */
  const deleteTrustedDevice = deviceId =>
    mexQuery({ device_id: deviceId }, PRIVACY_MEX_IDS.DELETE_TRUSTED_DEVICE, 'xwa2_delete_trusted_device')

  /**
   * Revoke multi-account link for a secondary account via MEX.
   */
  const revokeMultiAccount = accountJid =>
    mexQuery({ account_jid: accountJid }, PRIVACY_MEX_IDS.MULTI_ACCOUNT_REVOKE, 'xwa2_multi_account_revoke')

  // ── Misc ───────────────────────────────────────────────────────────────

  /**
   * Fetch mobile config via MEX.
   */
  const fetchMobileConfig = (apiVersion = 0, epRefreshId = 0, flags = '') =>
    mexQuery(
      { api_version: apiVersion, ep_refresh_id: epRefreshId, flags },
      PRIVACY_MEX_IDS.MOBILE_CONFIG_FETCH,
      'xwa2_mobile_config_fetch'
    )

  /**
   * Notify group members of your push name via MEX.
   */
  const notifyPushName = (groupJid, participants) =>
    mexQuery(
      {
        input: {
          group_jid: groupJid,
          participants: participants.map(({ jid, pushName }) => ({ jid, push_name: pushName }))
        }
      },
      PRIVACY_MEX_IDS.NOTIFY_PUSH_NAME,
      'xwa2_notify_push_name'
    )

  /**
   * Run a contact integrity check via MEX.
   */
  const contactIntegrityQuery = (jids, useCase = 'START_CHAT_CONTEXT') =>
    mexQuery(
      { users: jids.map(jid => ({ jid })), use_case: useCase },
      PRIVACY_MEX_IDS.CONTACT_INTEGRITY,
      'xwa2_fetch_wa_users'
    )

  /**
   * Run a business integrity check via MEX.
   */
  const bizIntegrityQuery = jids =>
    mexQuery(
      { users: jids.map(jid => ({ jid })) },
      PRIVACY_MEX_IDS.BIZ_INTEGRITY,
      'xwa2_fetch_wa_users'
    )

  /**
   * Set linked social profiles FB IG via MEX.
   */
  const linkedProfilesSet = profiles => {
    const mapped = profiles.map(p => {
      const entry = { type: p.type }
      if (p.vid) entry.vid = p.vid
      else if (p.username) entry.username = p.username
      return entry
    })
    return mexQuery({ profiles: mapped }, PRIVACY_MEX_IDS.LINKED_PROFILES_SET, 'xwa2_linked_profiles_set')
  }

  /**
   * Remove linked social profiles via MEX.
   */
  const linkedProfilesRemove = types =>
    mexQuery(
      { profiles: types.map(type => ({ type })) },
      PRIVACY_MEX_IDS.LINKED_PROFILES_REMOVE,
      'xwa2_linked_profiles_remove'
    )

  /**
   * Update linked social profile visibility settings via MEX.
   */
  const linkedProfilesUpdate = profiles =>
    mexQuery(
      { profiles: profiles.map(({ type, showOnProfile }) => ({ type, show_on_profile: showOnProfile })) },
      PRIVACY_MEX_IDS.LINKED_PROFILES_UPDATE,
      'xwa2_linked_profiles_update'
    )

  /**
   * Migrate blocklist to LID addressing via MEX.
   */
  const migrateBlocklistLid = (jids, dhash = '', dirtyAck = true) =>
    mexQuery(
      {
        input: {
          blocklist: jids.map(jid => ({ jid })),
          dhash,
          dirty_ack: dirtyAck
        }
      },
      PRIVACY_MEX_IDS.MIGRATE_BLOCKLIST_LID,
      'xwa2_migrate_blocklist_lid'
    )

  /**
   * Scan a QR code via MEX.
   */
  const qrCodeScan = qrData =>
    mexQuery({ qr_data: qrData }, PRIVACY_MEX_IDS.QR_CODE_SCAN, 'xwa2_qr_code_scan')

  return {
...sock,
    // Privacy
    getPrivacySettings,
    setPrivacySetting,
    updatePrivacyContactList,
    getPrivacyContactList,
    // Status / profile
    updateTextStatus,
    getTextStatusList,
    updateUserStatus,
    fetchUserPictureInfo,
    setProfilePictureMex,
    // Account / auth
    accountLogin,
    accountLogout,
    addMultiAccountLink,
    addTrustedDevice,
    getTrustedDevices,
    untrustTrustedDevice,
    deleteTrustedDevice,
    revokeMultiAccount,
    // Misc
    fetchMobileConfig,
    notifyPushName,
    contactIntegrityQuery,
    bizIntegrityQuery,
    linkedProfilesSet,
    linkedProfilesRemove,
    linkedProfilesUpdate,
    migrateBlocklistLid,
    qrCodeScan,
    PRIVACY_MEX_IDS
  }
}