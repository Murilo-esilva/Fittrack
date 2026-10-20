// A persistência dos treinos é exclusivamente remota. sessionStorage guarda só a sessão de autenticação.
(function () {
  let client;

  function init() {
    const config = window.FITTRACK_CONFIG || {};
    if (!config.url || !/^https:\/\/[^/]+\.supabase\.co\/?$/.test(config.url) ||
        !config.publishableKey || config.publishableKey.includes('SUA_CHAVE')) {
      throw new Error('Supabase não configurado. Preencha config.js conforme o README.');
    }
    if (!window.supabase?.createClient) {
      throw new Error('Não foi possível carregar a biblioteca do Supabase. Verifique a conexão.');
    }
    client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: {
        storage: window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return client;
  }

  async function load() {
    const { data, error } = await client
      .from('fittrack_state')
      .select('payload,revision')
      .maybeSingle();
    if (error) throw error;
    return data ? { payload: data.payload, revision: Number(data.revision) } :
      { payload: { records: [], drafts: {}, weights: {} }, revision: 0 };
  }

  async function save(payload, expectedRevision) {
    const { data, error } = await client.rpc('save_fittrack_state', {
      p_data: payload,
      p_expected_revision: expectedRevision
    });
    if (error) throw error;
    if (!Array.isArray(data) || data.length !== 1) {
      throw new Error('Resposta inesperada do banco de dados.');
    }
    return { saved: Boolean(data[0].saved), revision: Number(data[0].revision) };
  }

  window.FitTrackCloud = { init, load, save };
})();
