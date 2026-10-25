/* Public Retell settings for the static GitHub Pages site.
   NEVER put RETELL_API_KEY (the secret named bdhousing-voice) in this file.
   Agent IDs are account identifiers, not secrets.
   publicKey is the domain-allowlisted Retell public key (public_key_...).
   proxyUrl is either:
     - the Node proxy origin, e.g. https://voice.example.com
     - or the n8n outbound webhook, e.g. https://n8n.example.com/webhook/bdhousing/retell-outbound
   The secret API key stays in the proxy or n8n environment. */
window.BDHOUSING_RETELL = {
  workspace: "BDHousing",
  orgId: "org_b6zBp6LIqhl3aV7n",
  inboundAgentId: "agent_dc1a3df8b89476e4868363ee98",
  outboundAgentId: "agent_2603c7b2c919d2677273e30634",
  publicKey: "",
  proxyUrl: ""
};
