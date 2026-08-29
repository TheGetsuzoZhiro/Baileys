import * as Types from '../Types/index.js'
import { generateProfilePicture } from '../Utils/messages-media.js'
import { getBinaryNodeChild } from '../WABinary/index.js'
import { makeGroupsSocket } from './groups.js'
import { executeWMexQuery } from './mex.js'

const parseNewsletterCreateResponse = response => {
  const { id, thread_metadata: thread, viewer_metadata: viewer } = response
  return {
    id: id,
    owner: undefined,
    name: thread.name.text,
    creation_time: parseInt(thread.creation_time, 10),
    description: thread.description.text,
    invite: thread.invite,
    subscribers: parseInt(thread.subscribers_count, 10),
    verification: thread.verification,
    picture: {
      id: thread.picture.id,
      directPath: thread.picture.direct_path
    },
    mute_state: viewer.mute
  }
}

const parseNewsletterMetadata = result => {
  if (typeof result!== 'object' || result === null) {
    return null
  }
  if ('id' in result && typeof result.id === 'string') {
    return result
  }
  if ('result' in result && typeof result.result === 'object' && result.result!== null && 'id' in result.result) {
    return result.result
  }
  return null
}

export const makeNewsletterSocket = config => {
  const sock = makeGroupsSocket(config)
  const { query, generateMessageTag } = sock

  const mexQuery = (variables, queryId, dataPath) => {
    return executeWMexQuery(variables, queryId, dataPath, query, generateMessageTag)
  }

  const newsletterUpdate = async (jid, updates) => {
    const variables = {
      newsletter_id: jid,
      updates: {
      ...updates,
        settings: null
      }
    }
    return mexQuery(variables, Types.QueryIds.UPDATE_METADATA, 'xwa2_newsletter_update')
  }

  return {
  ...sock,
    newsletterFetchAllSubscribe: async () => {
      const list = await executeWMexQuery(
        {},
        Types.QueryIds.FETCH_SUBSCRIBE,
        Types.XWAPaths.xwa2_newsletter_subscribed,
        query,
        generateMessageTag
      );
      return list;
    },
    newsletterCreate: async (name, description) => {
      const variables = {
        input: {
          name,
          description: description?? null
        }
      }
      const rawResponse = await mexQuery(
        variables,
        Types.QueryIds.CREATE,
        Types.XWAPaths.xwa2_newsletter_create
      )
      return parseNewsletterCreateResponse(rawResponse)
    },

    newsletterUpdate,

    newsletterSubscribers: async jid => {
      return mexQuery(
        { newsletter_id: jid },
        Types.QueryIds.SUBSCRIBERS,
        Types.XWAPaths.xwa2_newsletter_subscribers
      )
    },

    newsletterMetadata: async (type, key) => {
      const variables = {
        fetch_creation_time: true,
        fetch_full_image: true,
        fetch_viewer_metadata: true,
        input: {
          key,
          type: type.toUpperCase()
        }
      }
      const result = await mexQuery(
        variables,
        Types.QueryIds.METADATA,
        Types.XWAPaths.xwa2_newsletter_metadata
      )
      return parseNewsletterMetadata(result)
    },

    newsletterFollow: jid => {
      return mexQuery({ newsletter_id: jid }, Types.QueryIds.FOLLOW, Types.XWAPaths.xwa2_newsletter_follow)
    },

    newsletterUnfollow: jid => {
      return mexQuery(
        { newsletter_id: jid },
        Types.QueryIds.UNFOLLOW,
        Types.XWAPaths.xwa2_newsletter_unfollow
      )
    },

    newsletterMute: jid => {
      return mexQuery({ newsletter_id: jid }, Types.QueryIds.MUTE, Types.XWAPaths.xwa2_newsletter_mute_v2)
    },

    newsletterUnmute: jid => {
      return mexQuery(
        { newsletter_id: jid },
        Types.QueryIds.UNMUTE,
        Types.XWAPaths.xwa2_newsletter_unmute_v2
      )
    },

    newsletterUpdateName: async (jid, name) => {
      return await newsletterUpdate(jid, { name })
    },

    newsletterUpdateDescription: async (jid, description) => {
      return await newsletterUpdate(jid, { description })
    },

    newsletterUpdatePicture: async (jid, content) => {
      const { img } = await generateProfilePicture(content)
      return await newsletterUpdate(jid, { picture: img.toString('base64') })
    },

    newsletterRemovePicture: async jid => {
      return await newsletterUpdate(jid, { picture: '' })
    },

    newsletterReactMessage: async (jid, serverId, reaction) => {
      await query({
        tag: 'message',
        attrs: {
          to: jid,
        ...(reaction? {} : { edit: '7' }),
          type: 'reaction',
          server_id: serverId,
          id: generateMessageTag()
        },
        content: [
          {
            tag: 'reaction',
            attrs: reaction? { code: reaction } : {}
          }
        ]
      })
    },

    newsletterFetchMessages: async (jid, count, since, after) => {
      const messageUpdateAttrs = {
        count: count.toString()
      }
      if (typeof since === 'number') {
        messageUpdateAttrs.since = since.toString()
      }
      if (after) {
        messageUpdateAttrs.after = after.toString()
      }
      const result = await query({
        tag: 'iq',
        attrs: {
          id: generateMessageTag(),
          type: 'get',
          xmlns: 'newsletter',
          to: jid
        },
        content: [
          {
            tag: 'message_updates',
            attrs: messageUpdateAttrs
          }
        ]
      })
      return result
    },

    subscribeNewsletterUpdates: async jid => {
      const result = await query({
        tag: 'iq',
        attrs: {
          id: generateMessageTag(),
          type: 'set',
          xmlns: 'newsletter',
          to: jid
        },
        content: [{ tag: 'live_updates', attrs: {}, content: [] }]
      })
      const liveUpdatesNode = getBinaryNodeChild(result, 'live_updates')
      const duration = liveUpdatesNode?.attrs?.duration
      return duration? { duration: duration } : null
    },

    newsletterAdminCount: async jid => {
      const response = await mexQuery(
        { newsletter_id: jid },
        Types.QueryIds.ADMIN_COUNT,
        Types.XWAPaths.xwa2_newsletter_admin_count
      )
      return response.admin_count
    },

    newsletterChangeOwner: async (jid, newOwnerJid) => {
      await mexQuery(
        { newsletter_id: jid, user_id: newOwnerJid },
        Types.QueryIds.CHANGE_OWNER,
        Types.XWAPaths.xwa2_newsletter_change_owner
      )
    },

    newsletterDemote: async (jid, userJid) => {
      await mexQuery(
        { newsletter_id: jid, user_id: userJid },
        Types.QueryIds.DEMOTE,
        Types.XWAPaths.xwa2_newsletter_demote
      )
    },

    newsletterDelete: async jid => {
      await mexQuery(
        { newsletter_id: jid },
        Types.QueryIds.DELETE,
        Types.XWAPaths.xwa2_newsletter_delete_v2
      )
    },

    /**
     * Update newsletter category/topic
     */
    newsletterUpdateCategory: async (jid, category) => {
      return newsletterUpdate(jid, { topic: category })
    },

    /**
     * Update newsletter invite codes / settings
     */
    newsletterUpdateSettings: async (jid, settings) => {
      const variables = { newsletter_id: jid, updates: { settings } }
      return mexQuery(variables, Types.QueryIds.UPDATE_METADATA, 'xwa2_newsletter_update')
    },

    /**
     * Promote a subscriber to admin
     */
    newsletterPromoteAdmin: async (jid, userJid) => {
      await query({
        tag: 'iq',
        attrs: {
          id: generateMessageTag(),
          type: 'set',
          xmlns: 'newsletter',
          to: jid
        },
        content: [
          {
            tag: 'admin_promote',
            attrs: {},
            content: [{ tag: 'participant', attrs: { jid: userJid } }]
          }
        ]
      })
    },

    /**
     * Get newsletter view/reach statistics
     */
    newsletterViewStats: async (jid, serverId) => {
      const result = await query({
        tag: 'iq',
        attrs: {
          id: generateMessageTag(),
          type: 'get',
          xmlns: 'newsletter',
          to: jid
        },
        content: [
          {
            tag: 'message_updates',
            attrs: { count: '1', server_id: String(serverId) }
          }
        ]
      })
      return result
    },

    /**
     * Send a newsletter post via IQ (alternative to sendMessage for newsletters)
     */
    newsletterSendPost: async (jid, content, options = {}) => {
      const result = await query({
        tag: 'iq',
        attrs: {
          id: generateMessageTag(),
          type: 'set',
          xmlns: 'newsletter',
          to: jid
        },
        content: [
          {
            tag: 'publish',
            attrs: {},
            content: Array.isArray(content)? content : [content]
          }
        ]
      })
      return result
    },

    /**
     * Pin a newsletter message
     */
    newsletterPinMessage: async (jid, serverId, durationSecs = 86400) => {
      await query({
        tag: 'iq',
        attrs: {
          id: generateMessageTag(),
          type: 'set',
          xmlns: 'newsletter',
          to: jid
        },
        content: [
          {
            tag: 'pin',
            attrs: { server_id: String(serverId), duration: String(durationSecs) }
          }
        ]
      })
    },

    /**
     * Unpin a newsletter message
     */
    newsletterUnpinMessage: async (jid, serverId) => {
      await query({
        tag: 'iq',
        attrs: {
          id: generateMessageTag(),
          type: 'set',
          xmlns: 'newsletter',
          to: jid
        },
        content: [
          {
            tag: 'unpin',
            attrs: { server_id: String(serverId) }
          }
        ]
      })
    },

    /**
     * Invite a user to become an admin of a newsletter.
     */
    newsletterInviteAdmin: async (jid, userJid) => {
      return mexQuery(
        { newsletter_id: jid, user_id: userJid },
        Types.QueryIds.ADMIN_INVITE,
        Types.XWAPaths.xwa2_newsletter_admin_invite_create
      )
    },

    /**
     * Revoke a pending admin invite for a newsletter.
     */
    newsletterRevokeAdminInvite: async (jid, userJid) => {
      return mexQuery(
        { newsletter_id: jid, user_id: userJid },
        Types.QueryIds.ADMIN_INVITE_REVOKE,
        Types.XWAPaths.xwa2_newsletter_admin_invite_revoke
      )
    },

    /**
     * Accept an admin invite to a newsletter (called by the invitee).
     */
    newsletterAcceptAdminInvite: async jid => {
      return mexQuery(
        { newsletter_id: jid },
        Types.QueryIds.ADMIN_INVITE_ACCEPT,
        Types.XWAPaths.xwa2_newsletter_admin_invite_accept
      )
    },

    /**
     * Fetch admin-side metadata for a newsletter.
     */
    newsletterAdminMetadata: async (jid, options = {}) => {
      const {
        fetchPendingAdmins = true,
        fetchAdminCount = true,
        fetchCapabilities = false,
        fetchAdminProfile = false,
        includeAdminSettings = false,
        includeJarvisConfig = false
      } = options
      return mexQuery(
        {
          jid,
          include_thread_metadata: false,
          include_messages: false,
          fetch_pending_admin_invites: fetchPendingAdmins,
          fetch_admin_count: fetchAdminCount,
          fetch_capabilities: fetchCapabilities,
          fetch_admin_profile: fetchAdminProfile,
          include_admin_settings: includeAdminSettings,
          include_jarvis_config: includeJarvisConfig
        },
        Types.QueryIds.ADMIN_METADATA,
        Types.XWAPaths.xwa2_newsletter_admin
      )
    },

    /**
     * Update admin profile fields for a newsletter
     */
    newsletterAdminProfileUpdate: async (jid, updates) => {
      return mexQuery(
        { newsletter_id: jid, updates },
        Types.QueryIds.ADMIN_PROFILE_UPDATE,
        Types.XWAPaths.xwa2_newsletter_admin_profile_update
      )
    },

    /**
     * Browse the newsletter directory by category.
     */
    newsletterDirectoryList: async (options = {}) => {
      const { limit = 20, interests = null, sortField = 'SUBSCRIBER_COUNT', sortOrder = 'DESC' } = options
      const variables = { limit, sort_field: sortField, sort_order: sortOrder }
      if (interests?.length) variables.interests = interests
      return mexQuery(variables, Types.QueryIds.DIRECTORY_LIST, Types.XWAPaths.xwa2_newsletters_directory_list)
    },

    /**
     * Search the newsletter directory.
     */
    newsletterDirectorySearch: async (searchText, options = {}) => {
      const { limit = 20, startCursor = null, categories = null } = options
      const variables = { search_text: searchText, limit }
      if (startCursor) variables.start_cursor = startCursor
      if (categories?.length) variables.categories = categories
      return mexQuery(
        variables,
        Types.QueryIds.DIRECTORY_SEARCH,
        Types.XWAPaths.xwa2_newsletters_directory_search
      )
    },

    /**
     * Fetch a preview of newsletters grouped by directory category.
     */
    newsletterDirectoryCategoryPreview: async (limit = 5) => {
      return mexQuery(
        { limit },
        Types.QueryIds.DIRECTORY_CATEGORY_PREVIEW,
        Types.XWAPaths.xwa2_newsletters_directory_category_preview
      )
    },

    /**
     * Search for newsletters by text query.
     */
    newsletterSearch: async (query, limit = 20, startCursor = null) => {
      const variables = { query, limit }
      if (startCursor) variables.start_cursor = startCursor
      return mexQuery(variables, Types.QueryIds.SEARCH, Types.XWAPaths.xwa2_newsletters_search)
    },

    /**
     * Fetch recommended newsletters.
     */
    newsletterRecommended: async (limit = 10, numFollowed = null) => {
      const variables = { limit }
      if (numFollowed!= null) variables.num_newsletters_followed = numFollowed
      return mexQuery(variables, Types.QueryIds.RECOMMENDED, Types.XWAPaths.xwa2_newsletters_recommended)
    },

    /**
     * Fetch newsletters similar to a given newsletter.
     */
    newsletterSimilar: async (jid, limit = 10) => {
      return mexQuery(
        { newsletter_id: jid, limit },
        Types.QueryIds.SIMILAR,
        Types.XWAPaths.xwa2_newsletters_similar
      )
    },

    /**
     * Fetch the list of newsletters the current user is following.
     */
    newsletterFollowingList: async (startCursor = null, limit = 20) => {
      const variables = { limit }
      if (startCursor) variables.start_cursor = startCursor
      return mexQuery(variables, Types.QueryIds.FOLLOWING_LIST, Types.XWAPaths.xwa2_newsletter_following)
    },

    /**
     * Fetch admin insights/analytics for a newsletter.
     */
    newsletterInsights: async (jid, period = null) => {
      const variables = { newsletter_id: jid }
      if (period) variables.period = period
      return mexQuery(variables, Types.QueryIds.INSIGHTS, Types.XWAPaths.xwa2_newsletter_admin_insights)
    },

    /**
     * Fetch the list of users who voted in a newsletter poll.
     */
    newsletterPollVoterList: async (jid, serverId, option = null, startCursor = null) => {
      const variables = { id: jid, server_id: serverId }
      if (option!= null) variables.option = option
      if (startCursor) variables.start_cursor = startCursor
      return mexQuery(
        variables,
        Types.QueryIds.POLL_VOTER_LIST,
        Types.XWAPaths.xwa2_newsletters_poll_voter_list
      )
    },

    /**
     * Fetch the list of users who reacted to a newsletter message.
     */
    newsletterReactionSenders: async (jid, serverId, startCursor = null) => {
      const variables = { id: jid, server_id: serverId }
      if (startCursor) variables.start_cursor = startCursor
      return mexQuery(
        variables,
        Types.QueryIds.REACTION_SENDERS_LIST,
        Types.XWAPaths.xwa2_newsletters_reaction_sender_list
      )
    },

    /**
     * Block a user from a newsletter (admin action).
     */
    newsletterBlockUser: async (jid, userJid) => {
      return mexQuery(
        { newsletter_id: jid, user_id: userJid },
        Types.QueryIds.BLOCK_USER,
        'xwa2_newsletter_block_user'
      )
    },

    /**
     * Enable Wamo (paid subscription) for a newsletter.
     */
    newsletterEnableWamo: async jid => {
      return mexQuery({ newsletter_id: jid }, Types.QueryIds.WAMO_ENABLE_SUB, 'xwa2_newsletter_wamo_enable_sub')
    },

    /**
     * Disable Wamo (paid subscription) for a newsletter.
     */
    newsletterDisableWamo: async jid => {
      return mexQuery(
        { newsletter_id: jid },
        Types.QueryIds.WAMO_DISABLE_SUB,
        'xwa2_newsletter_wamo_disable_sub'
      )
    },

    /**
     * Change the Wamo subscription tier or settings for a newsletter.
     */
    newsletterChangeWamo: async (jid, subConfig) => {
      return mexQuery(
        { newsletter_id: jid,...subConfig },
        Types.QueryIds.WAMO_CHANGE_SUB,
        'xwa2_newsletter_wamo_change_sub'
      )
    },

    /**
     * Wamo helpers
     */
    wamoAfsAgeCollection: async jid =>
      mexQuery({ newsletter_id: jid }, Types.QueryIds.WAMO_AFS_AGE_COLLECTION, Types.XWAPaths.xwa2_wamo_afs_age_collection),

    wamoAssetCollection: async jid =>
      mexQuery({ newsletter_id: jid }, Types.QueryIds.WAMO_ASSET_COLLECTION, Types.XWAPaths.xwa2_wamo_asset_collection),

    wamoFetchAdhocNotice: async noticeId =>
      mexQuery({ notice_id: noticeId }, Types.QueryIds.WAMO_FETCH_ADHOC_NOTICE, Types.XWAPaths.xwa2_wamo_fetch_adhoc_notice_by_id),

    wamoFetchIdentityToken: async jid =>
      mexQuery({ newsletter_id: jid }, Types.QueryIds.WAMO_FETCH_IDENTITY_TOKEN, Types.XWAPaths.xwa2_wamo_fetch_identity_token),

    wamoSubComplianceInfo: async jid =>
      mexQuery({ newsletter_id: jid }, Types.QueryIds.WAMO_SUB_COMPLIANCE_INFO, Types.XWAPaths.xwa2_wamo_sub_get_compliance_info),

    wamoUserIdVersion: async jid =>
      mexQuery({ newsletter_id: jid }, Types.QueryIds.WAMO_USER_ID_VERSION, Types.XWAPaths.xwa2_wamo_user_id_version),

    wamoSetUserIdVersion: async (jid, version) =>
      mexQuery({ newsletter_id: jid, version }, Types.QueryIds.WAMO_SET_USER_ID_VERSION, Types.XWAPaths.xwa2_wamo_set_user_id_version),

    /**
     * Leave a newsletter (unsubscribe).
     */
    newsletterLeave: async jid =>
      mexQuery({ newsletter_id: jid }, Types.QueryIds.LEAVE, Types.XWAPaths.xwa2_newsletter_leave_v2),

    /**
     * Create a verified newsletter.
     */
    newsletterCreateVerified: async (name, description = null) =>
      mexQuery(
        { input: { name, description } },
        Types.QueryIds.CREATE_VERIFIED,
        Types.XWAPaths.xwa2_newsletter_create_verified
      ),

    /**
     * Fetch newsletter enforcements (ban/restriction info).
     */
    newsletterEnforcements: async jid =>
      mexQuery({ newsletter_id: jid }, Types.QueryIds.ENFORCEMENTS, Types.XWAPaths.xwa2_newsletter_enforcements),

    /**
     * Fetch user reports for a newsletter (admin action).
     */
    newsletterUserReports: async (jid, cursor = null) => {
      const variables = { newsletter_id: jid }
      if (cursor) variables.cursor = cursor
      return mexQuery(variables, Types.QueryIds.USER_REPORTS, Types.XWAPaths.xwa2_newsletter_user_reports)
    },

    /**
     * Create a report appeal for a newsletter.
     */
    newsletterCreateReportAppeal: async (jid, reason) =>
      mexQuery(
        { newsletter_id: jid, reason },
        Types.QueryIds.CREATE_REPORT_APPEAL,
        Types.XWAPaths.xwa2_newsletter_create_report_appeal
      ),

    /**
     * Check a newsletter link preview.
     */
    newsletterLinkPreviewCheck: async url =>
      mexQuery({ url }, Types.QueryIds.LINK_PREVIEW_CHECK, Types.XWAPaths.xwa2_newsletter_link_preview_check),

    /**
     * Update newsletter verification status.
     */
    newsletterUpdateVerification: async (jid, verification) =>
      mexQuery(
        { newsletter_id: jid, verification },
        Types.QueryIds.UPDATE_VERIFICATION,
        Types.XWAPaths.xwa2_newsletter_update_verification
      ),

    /**
     * Label a newsletter post as paid partnership.
     */
    newsletterLabelPaidPartnership: async (jid, serverId, isPaidPartnership) =>
      mexQuery(
        { newsletter_id: jid, server_id: serverId, is_paid_partnership: isPaidPartnership },
        Types.QueryIds.LABEL_PAID_PARTNERSHIP,
        Types.XWAPaths.xwa2_newsletter_label_paid_partnership
      ),

    /**
     * Log newsletter exposure events (analytics).
     */
    newsletterLogExposures: async events =>
      mexQuery({ events }, Types.QueryIds.LOG_EXPOSURES, Types.XWAPaths.xwa2_newsletter_log_exposures),

    /**
     * Update user-specific newsletter setting.
     */
    newsletterUpdateUserSetting: async (jid, setting) =>
      mexQuery(
        { newsletter_id: jid,...setting },
        Types.QueryIds.UPDATE_USER_SETTING,
        Types.XWAPaths.xwa2_newsletter_update_user_setting
      ),

    /**
     * Fetch newsletter ranking features (ML signals).
     */
    newsletterRankingFeatures: async jid =>
      mexQuery(
        { newsletter_id: jid },
        Types.QueryIds.RANKING_FEATURES,
        Types.XWAPaths.xwa2_newsletter_ranking_features
      ),

    /**
     * Send view receipts for newsletter messages.
     */
    newsletterSendViewReceipt: async (jid, serverMessageIds) => {
      const ids = Array.isArray(serverMessageIds)? serverMessageIds : [serverMessageIds]
      const receiptId = generateMessageTag()
      await query({
        tag: 'receipt',
        attrs: {
          to: jid,
          id: receiptId,
          type: 'view'
        },
        content: [
          {
            tag: 'list',
            attrs: {},
            content: ids.map(id => ({ tag: 'item', attrs: { server_id: String(id) } }))
          }
        ]
      })
    }
  }
}