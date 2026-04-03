const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

module.exports.config = {
  name: "fbreport",
  version: "2.1.0",
  role: 2, // Admin only for safety
  credits: "selov",
  description: "Report Facebook accounts using cookie",
  commandCategory: "utility",
  usages: "/fbreport <cookie> <uid>",
  cooldowns: 30,
  aliases: ["reportfb", "fbacc"]
};

// Headers for Facebook requests
function getHeaders1() {
  return {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'max-age=0',
    'Sec-Ch-Ua': '',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36'
  };
}

function getHeaders2() {
  return {
    'accept': '*/*',
    'accept-encoding': 'gzip, deflate',
    'accept-language': 'en-US,en;q=0.9',
    'content-type': 'application/x-www-form-urlencoded',
    'origin': 'https://www.facebook.com',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36'
  };
}

// Extract values from HTML response
function extractValues(html) {
  const values = {};
  
  const actorMatch = html.match(/"actorID":"(.*?)"/);
  if (actorMatch) values.actorID = actorMatch[1];
  
  const hasteMatch = html.match(/"haste_session":"(.*?)"/);
  if (hasteMatch) values.hasteSession = hasteMatch[1];
  
  const connClassMatch = html.match(/"connectionClass":"(.*?)"/);
  if (connClassMatch) values.connectionClass = connClassMatch[1];
  
  const spinRMatch = html.match(/"__spin_r":(.*?),/);
  if (spinRMatch) values.spinR = spinRMatch[1];
  
  const spinBMatch = html.match(/"__spin_b":"(.*?)"/);
  if (spinBMatch) values.spinB = spinBMatch[1];
  
  const spinTMatch = html.match(/"__spin_t":(.*?),/);
  if (spinTMatch) values.spinT = spinTMatch[1];
  
  const hsiMatch = html.match(/"hsi":"(.*?)"/);
  if (hsiMatch) values.hsi = hsiMatch[1];
  
  const dtsgMatch = html.match(/"DTSGInitialData",\[\],{"token":"(.*?)"}/);
  if (dtsgMatch) values.dtsg = dtsgMatch[1];
  
  const jazoestMatch = html.match(/jazoest=(.*?)"/);
  if (jazoestMatch) values.jazoest = jazoestMatch[1];
  
  const lsdMatch = html.match(/"LSD",\[\],{"token":"(.*?)"}/);
  if (lsdMatch) values.lsd = lsdMatch[1];
  
  const sessionMatch = html.match(/"sessionID":"(.*?)"/);
  if (sessionMatch) values.sessionID = sessionMatch[1];
  
  return values;
}

// Format cookie string properly
function formatCookie(cookieString) {
  // Remove any extra quotes and spaces
  let cleanCookie = cookieString.replace(/^["']|["']$/g, '').trim();
  
  // Ensure cookie is in proper format
  // Example: datr=xxx; fr=xxx; c_user=xxx; xs=xxx
  return cleanCookie;
}

async function reportAccount(cookie, targetUid) {
  try {
    const formattedCookie = formatCookie(cookie);
    
    // First request to get initial page
    const response1 = await axios.get('https://www.facebook.com/', {
      headers: {
        'Cookie': formattedCookie,
        ...getHeaders1()
      },
      timeout: 30000,
      maxRedirects: 5
    });
    
    const html = response1.data.replace(/\\/g, '');
    const values = extractValues(html);
    
    if (!values.actorID) {
      throw new Error("Failed to extract required data from Facebook. Cookie may be invalid or expired.");
    }
    
    const aa = Math.floor(Math.random() * 5) + 1;
    
    // Prepare base data
    const baseData = {
      av: values.actorID,
      __user: values.actorID,
      __a: aa.toString(),
      __hs: values.hasteSession || '',
      dpr: '1.5',
      __ccg: values.connectionClass || '',
      __rev: values.spinR || '',
      __spin_r: values.spinR || '',
      __spin_b: values.spinB || '',
      __spin_t: values.spinT || '',
      __hsi: values.hsi || '',
      __comet_req: '15',
      fb_dtsg: values.dtsg || '',
      jazoest: values.jazoest || '',
      lsd: values.lsd || ''
    };
    
    const gqlUrl = 'https://www.facebook.com/api/graphql/';
    
    // Step 1: Content Trigger
    const v1 = {
      input: {
        content_id: targetUid,
        entry_point: "PROFILE_REPORT_BUTTON",
        location: "PROFILE_SOMEONE_ELSE",
        trigger_event_type: "REPORT_BUTTON_CLICKED",
        nt_context: null,
        trigger_session_id: values.sessionID
      },
      scale: 1
    };
    
    const data1 = {
      ...baseData,
      fb_api_caller_class: 'RelayModern',
      fb_api_req_friendly_name: 'CometIXTFacebookContentTriggerRootQuery',
      variables: JSON.stringify(v1),
      server_timestamps: true,
      doc_id: '6769900669784116'
    };
    
    const r1 = await axios.post(gqlUrl, new URLSearchParams(data1), {
      headers: {
        'Cookie': formattedCookie,
        ...getHeaders2()
      },
      timeout: 30000
    });
    
    const ct = r1.data?.data?.ixt_content_trigger?.screen?.view_model?.context;
    const srl = r1.data?.data?.ixt_content_trigger?.screen?.view_model?.serialized_state;
    
    if (!ct || !srl) {
      throw new Error("Failed to get report context");
    }
    
    // Step 2: Report selection (Fake Account)
    const v2 = {
      input: {
        frx_tag_selection_screen: {
          context: ct,
          serialized_state: srl,
          show_tag_search: false,
          tags: ["PROFILE_FAKE_ACCOUNT"]
        },
        actor_id: values.actorID,
        client_mutation_id: "1"
      },
      scale: 1
    };
    
    const data2 = {
      ...baseData,
      fb_api_caller_class: 'RelayModern',
      fb_api_req_friendly_name: 'CometFacebookIXTNextMutation',
      variables: JSON.stringify(v2),
      server_timestamps: true,
      doc_id: '6914576615289569'
    };
    
    const r2 = await axios.post(gqlUrl, new URLSearchParams(data2), {
      headers: {
        'Cookie': formattedCookie,
        ...getHeaders2()
      },
      timeout: 30000
    });
    
    const ct2 = r2.data?.data?.ixt_screen_next?.view_model?.context;
    const srl2 = r2.data?.data?.ixt_screen_next?.view_model?.serialized_state;
    
    // Step 3: Confirmation screen
    const v3 = {
      input: {
        frx_report_confirmation_screen: {
          context: ct2,
          serialized_state: srl2
        },
        actor_id: values.actorID,
        client_mutation_id: "3"
      },
      scale: 1
    };
    
    const data3 = {
      ...baseData,
      fb_api_caller_class: 'RelayModern',
      fb_api_req_friendly_name: 'CometFacebookIXTNextMutation',
      variables: JSON.stringify(v3),
      server_timestamps: true,
      doc_id: '6914576615289569'
    };
    
    const r3 = await axios.post(gqlUrl, new URLSearchParams(data3), {
      headers: {
        'Cookie': formattedCookie,
        ...getHeaders2()
      },
      timeout: 30000
    });
    
    const ct3 = r3.data?.data?.ixt_screen_next?.view_model?.context;
    const srl3 = r3.data?.data?.ixt_screen_next?.view_model?.serialized_state;
    
    // Step 4: Final submit
    const v4 = {
      input: {
        frx_post_report_process_timeline: {
          context: ct3,
          serialized_state: srl3
        },
        actor_id: values.actorID,
        client_mutation_id: "4"
      },
      scale: 1
    };
    
    const data4 = {
      ...baseData,
      fb_api_caller_class: 'RelayModern',
      fb_api_req_friendly_name: 'CometFacebookIXTNextMutation',
      variables: JSON.stringify(v4),
      server_timestamps: true,
      doc_id: '6914576615289569'
    };
    
    const r4 = await axios.post(gqlUrl, new URLSearchParams(data4), {
      headers: {
        'Cookie': formattedCookie,
        ...getHeaders2()
      },
      timeout: 30000
    });
    
    // Check if report was successful
    const responseText = JSON.stringify(r4.data);
    if (responseText.includes('You have submitted a report') || 
        responseText.includes('success') ||
        r4.data?.data?.ixt_screen_next?.view_model?.success) {
      return { success: true, message: "Report submitted successfully" };
    } else {
      return { success: false, message: "Report submission failed" };
    }
    
  } catch (err) {
    console.error("Report Error:", err.message);
    return { success: false, message: err.message };
  }
}

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  
  // Parse arguments: cookie and UID
  let cookie = args[0];
  const uid = args[1];
  
  // If cookie is wrapped in quotes, remove them
  if (cookie && cookie.startsWith('"') && cookie.endsWith('"')) {
    cookie = cookie.slice(1, -1);
  }
  
  if (!cookie || !uid) {
    return api.sendMessage(
      `📢 **FB REPORT COMMAND**\n━━━━━━━━━━━━━━━━\n` +
      `Usage: /fbreport <cookie> <uid>\n\n` +
      `**Example Cookie Format:**\n` +
      `datr=xxx; fr=xxx; c_user=61583642705997; xs=xxx; ...\n\n` +
      `**Example Command:**\n` +
      `/fbreport "c_user=61583642705997; xs=4%3AcNLnjQBgyZHRHg" 100000123456789\n\n` +
      `⚠️ **Admin only command**`,
      threadID,
      messageID
    );
  }
  
  // Validate UID
  if (isNaN(uid)) {
    return api.sendMessage("❌ Invalid User ID. Please provide a valid Facebook UID.", threadID, messageID);
  }
  
  // Extract c_user from cookie for display
  const cUserMatch = cookie.match(/c_user=(\d+)/);
  const accountId = cUserMatch ? cUserMatch[1] : "Unknown";
  
  const waitingMsg = await api.sendMessage(
    `📢 **Reporting Account**\n━━━━━━━━━━━━━━━━\n` +
    `👤 **Reporting from:** ${accountId}\n` +
    `🆔 **Target UID:** ${uid}\n` +
    `⏳ Processing report...`,
    threadID
  );
  
  try {
    const result = await reportAccount(cookie, uid);
    
    const timestamp = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });
    
    if (result.success) {
      const successMsg = 
        `✅ **Report Submitted Successfully**\n━━━━━━━━━━━━━━━━\n` +
        `👤 **Reporting from:** ${accountId}\n` +
        `🆔 **Target UID:** ${uid}\n` +
        `📅 **Time:** ${timestamp}\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `⚠️ Facebook will review this report.`;
      
      await api.editMessage(successMsg, waitingMsg.messageID);
    } else {
      throw new Error(result.message);
    }
    
  } catch (err) {
    console.error("FB Report Error:", err);
    
    let errorMsg = 
      `❌ **Report Failed**\n━━━━━━━━━━━━━━━━\n` +
      `👤 **Reporting from:** ${accountId}\n` +
      `🆔 **Target UID:** ${uid}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🔴 **Error:** ${err.message}\n\n` +
      `💡 **Possible reasons:**\n` +
      `• Invalid or expired cookie\n` +
      `• Cookie doesn't have c_user and xs values\n` +
      `• Invalid UID\n` +
      `• Account already reported\n\n` +
      `**Required cookie values:**\n` +
      `• c_user (your Facebook ID)\n` +
      `• xs (session token)\n` +
      `• datr, fr, sb (optional but recommended)`;
    
    await api.editMessage(errorMsg, waitingMsg.messageID);
  }
};
