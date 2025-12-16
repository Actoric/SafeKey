// Переводы для всех языков

export interface Translations {
  // Общие
  common: {
    search: string;
    close: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    add: string;
    copy: string;
    copied: string;
    loading: string;
    error: string;
    success: string;
  };
  // Пароли
  passwords: {
    title: string;
    addPassword: string;
    editPassword: string;
    deletePassword: string;
    confirmDelete: string;
    noPasswords: string;
    searchPlaceholder: string;
    service: string;
    login: string;
    password: string;
    url: string;
    notes: string;
    showPassword: string;
    hidePassword: string;
    copyPassword: string;
    copyLogin: string;
    copyUrl: string;
    favorites: string;
    all: string;
  };
  // Оверлей
  overlay: {
    searchPlaceholder: string;
    noResults: string;
    searching: string;
  };
  // Настройки
  settings: {
    title: string;
    language: string;
    selectLanguage: string;
    updates: string;
    checkUpdates: string;
    currentVersion: string;
    upToDate: string;
  };
}

export const translations: Record<string, Translations> = {
  ru: {
    common: {
      search: 'Поиск',
      close: 'Закрыть',
      save: 'Сохранить',
      cancel: 'Отмена',
      delete: 'Удалить',
      edit: 'Редактировать',
      add: 'Добавить',
      copy: 'Копировать',
      copied: 'Скопировано!',
      loading: 'Загрузка...',
      error: 'Ошибка',
      success: 'Успешно',
    },
    passwords: {
      title: 'Пароли',
      addPassword: 'Добавить пароль',
      editPassword: 'Редактировать пароль',
      deletePassword: 'Удалить пароль',
      confirmDelete: 'Вы уверены, что хотите удалить этот пароль?',
      noPasswords: 'Пароли не найдены',
      searchPlaceholder: 'Поиск пароля...',
      service: 'Сервис',
      login: 'Логин',
      password: 'Пароль',
      url: 'URL',
      notes: 'Заметки',
      showPassword: 'Показать пароль',
      hidePassword: 'Скрыть пароль',
      copyPassword: 'Копировать пароль',
      copyLogin: 'Копировать логин',
      copyUrl: 'Копировать URL',
      favorites: 'Избранное',
      all: 'Все',
    },
    overlay: {
      searchPlaceholder: 'Поиск пароля...',
      noResults: 'Пароли не найдены',
      searching: 'Поиск...',
    },
    settings: {
      title: 'Настройки',
      language: 'Язык интерфейса',
      selectLanguage: 'Выберите язык',
      updates: 'Обновления',
      checkUpdates: 'Проверить обновления',
      currentVersion: 'Текущая версия',
      upToDate: 'Программа обновлена до последней версии',
    },
  },
  en: {
    common: {
      search: 'Search',
      close: 'Close',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      add: 'Add',
      copy: 'Copy',
      copied: 'Copied!',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
    },
    passwords: {
      title: 'Passwords',
      addPassword: 'Add Password',
      editPassword: 'Edit Password',
      deletePassword: 'Delete Password',
      confirmDelete: 'Are you sure you want to delete this password?',
      noPasswords: 'No passwords found',
      searchPlaceholder: 'Search password...',
      service: 'Service',
      login: 'Login',
      password: 'Password',
      url: 'URL',
      notes: 'Notes',
      showPassword: 'Show Password',
      hidePassword: 'Hide Password',
      copyPassword: 'Copy Password',
      copyLogin: 'Copy Login',
      copyUrl: 'Copy URL',
      favorites: 'Favorites',
      all: 'All',
    },
    overlay: {
      searchPlaceholder: 'Search password...',
      noResults: 'No passwords found',
      searching: 'Searching...',
    },
    settings: {
      title: 'Settings',
      language: 'Interface Language',
      selectLanguage: 'Select Language',
      updates: 'Updates',
      checkUpdates: 'Check for Updates',
      currentVersion: 'Current Version',
      upToDate: 'Application is up to date',
    },
  },
  de: {
    common: {
      search: 'Suchen',
      close: 'Schließen',
      save: 'Speichern',
      cancel: 'Abbrechen',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      add: 'Hinzufügen',
      copy: 'Kopieren',
      copied: 'Kopiert!',
      loading: 'Laden...',
      error: 'Fehler',
      success: 'Erfolg',
    },
    passwords: {
      title: 'Passwörter',
      addPassword: 'Passwort hinzufügen',
      editPassword: 'Passwort bearbeiten',
      deletePassword: 'Passwort löschen',
      confirmDelete: 'Sind Sie sicher, dass Sie dieses Passwort löschen möchten?',
      noPasswords: 'Keine Passwörter gefunden',
      searchPlaceholder: 'Passwort suchen...',
      service: 'Service',
      login: 'Anmeldung',
      password: 'Passwort',
      url: 'URL',
      notes: 'Notizen',
      showPassword: 'Passwort anzeigen',
      hidePassword: 'Passwort ausblenden',
      copyPassword: 'Passwort kopieren',
      copyLogin: 'Anmeldung kopieren',
      copyUrl: 'URL kopieren',
      favorites: 'Favoriten',
      all: 'Alle',
    },
    overlay: {
      searchPlaceholder: 'Passwort suchen...',
      noResults: 'Keine Passwörter gefunden',
      searching: 'Suchen...',
    },
    settings: {
      title: 'Einstellungen',
      language: 'Oberflächensprache',
      selectLanguage: 'Sprache auswählen',
      updates: 'Aktualisierungen',
      checkUpdates: 'Auf Updates prüfen',
      currentVersion: 'Aktuelle Version',
      upToDate: 'Anwendung ist auf dem neuesten Stand',
    },
  },
  fr: {
    common: {
      search: 'Rechercher',
      close: 'Fermer',
      save: 'Enregistrer',
      cancel: 'Annuler',
      delete: 'Supprimer',
      edit: 'Modifier',
      add: 'Ajouter',
      copy: 'Copier',
      copied: 'Copié!',
      loading: 'Chargement...',
      error: 'Erreur',
      success: 'Succès',
    },
    passwords: {
      title: 'Mots de passe',
      addPassword: 'Ajouter un mot de passe',
      editPassword: 'Modifier le mot de passe',
      deletePassword: 'Supprimer le mot de passe',
      confirmDelete: 'Êtes-vous sûr de vouloir supprimer ce mot de passe?',
      noPasswords: 'Aucun mot de passe trouvé',
      searchPlaceholder: 'Rechercher un mot de passe...',
      service: 'Service',
      login: 'Identifiant',
      password: 'Mot de passe',
      url: 'URL',
      notes: 'Notes',
      showPassword: 'Afficher le mot de passe',
      hidePassword: 'Masquer le mot de passe',
      copyPassword: 'Copier le mot de passe',
      copyLogin: 'Copier l\'identifiant',
      copyUrl: 'Copier l\'URL',
      favorites: 'Favoris',
      all: 'Tous',
    },
    overlay: {
      searchPlaceholder: 'Rechercher un mot de passe...',
      noResults: 'Aucun mot de passe trouvé',
      searching: 'Recherche...',
    },
    settings: {
      title: 'Paramètres',
      language: 'Langue de l\'interface',
      selectLanguage: 'Sélectionner la langue',
      updates: 'Mises à jour',
      checkUpdates: 'Vérifier les mises à jour',
      currentVersion: 'Version actuelle',
      upToDate: 'L\'application est à jour',
    },
  },
  es: {
    common: {
      search: 'Buscar',
      close: 'Cerrar',
      save: 'Guardar',
      cancel: 'Cancelar',
      delete: 'Eliminar',
      edit: 'Editar',
      add: 'Agregar',
      copy: 'Copiar',
      copied: '¡Copiado!',
      loading: 'Cargando...',
      error: 'Error',
      success: 'Éxito',
    },
    passwords: {
      title: 'Contraseñas',
      addPassword: 'Agregar contraseña',
      editPassword: 'Editar contraseña',
      deletePassword: 'Eliminar contraseña',
      confirmDelete: '¿Está seguro de que desea eliminar esta contraseña?',
      noPasswords: 'No se encontraron contraseñas',
      searchPlaceholder: 'Buscar contraseña...',
      service: 'Servicio',
      login: 'Inicio de sesión',
      password: 'Contraseña',
      url: 'URL',
      notes: 'Notas',
      showPassword: 'Mostrar contraseña',
      hidePassword: 'Ocultar contraseña',
      copyPassword: 'Copiar contraseña',
      copyLogin: 'Copiar inicio de sesión',
      copyUrl: 'Copiar URL',
      favorites: 'Favoritos',
      all: 'Todos',
    },
    overlay: {
      searchPlaceholder: 'Buscar contraseña...',
      noResults: 'No se encontraron contraseñas',
      searching: 'Buscando...',
    },
    settings: {
      title: 'Configuración',
      language: 'Idioma de la interfaz',
      selectLanguage: 'Seleccionar idioma',
      updates: 'Actualizaciones',
      checkUpdates: 'Buscar actualizaciones',
      currentVersion: 'Versión actual',
      upToDate: 'La aplicación está actualizada',
    },
  },
  it: {
    common: {
      search: 'Cerca',
      close: 'Chiudi',
      save: 'Salva',
      cancel: 'Annulla',
      delete: 'Elimina',
      edit: 'Modifica',
      add: 'Aggiungi',
      copy: 'Copia',
      copied: 'Copiato!',
      loading: 'Caricamento...',
      error: 'Errore',
      success: 'Successo',
    },
    passwords: {
      title: 'Password',
      addPassword: 'Aggiungi password',
      editPassword: 'Modifica password',
      deletePassword: 'Elimina password',
      confirmDelete: 'Sei sicuro di voler eliminare questa password?',
      noPasswords: 'Nessuna password trovata',
      searchPlaceholder: 'Cerca password...',
      service: 'Servizio',
      login: 'Accesso',
      password: 'Password',
      url: 'URL',
      notes: 'Note',
      showPassword: 'Mostra password',
      hidePassword: 'Nascondi password',
      copyPassword: 'Copia password',
      copyLogin: 'Copia accesso',
      copyUrl: 'Copia URL',
      favorites: 'Preferiti',
      all: 'Tutti',
    },
    overlay: {
      searchPlaceholder: 'Cerca password...',
      noResults: 'Nessuna password trovata',
      searching: 'Ricerca...',
    },
    settings: {
      title: 'Impostazioni',
      language: 'Lingua dell\'interfaccia',
      selectLanguage: 'Seleziona lingua',
      updates: 'Aggiornamenti',
      checkUpdates: 'Controlla aggiornamenti',
      currentVersion: 'Versione corrente',
      upToDate: 'L\'applicazione è aggiornata',
    },
  },
  pt: {
    common: {
      search: 'Pesquisar',
      close: 'Fechar',
      save: 'Salvar',
      cancel: 'Cancelar',
      delete: 'Excluir',
      edit: 'Editar',
      add: 'Adicionar',
      copy: 'Copiar',
      copied: 'Copiado!',
      loading: 'Carregando...',
      error: 'Erro',
      success: 'Sucesso',
    },
    passwords: {
      title: 'Senhas',
      addPassword: 'Adicionar senha',
      editPassword: 'Editar senha',
      deletePassword: 'Excluir senha',
      confirmDelete: 'Tem certeza de que deseja excluir esta senha?',
      noPasswords: 'Nenhuma senha encontrada',
      searchPlaceholder: 'Pesquisar senha...',
      service: 'Serviço',
      login: 'Login',
      password: 'Senha',
      url: 'URL',
      notes: 'Notas',
      showPassword: 'Mostrar senha',
      hidePassword: 'Ocultar senha',
      copyPassword: 'Copiar senha',
      copyLogin: 'Copiar login',
      copyUrl: 'Copiar URL',
      favorites: 'Favoritos',
      all: 'Todos',
    },
    overlay: {
      searchPlaceholder: 'Pesquisar senha...',
      noResults: 'Nenhuma senha encontrada',
      searching: 'Pesquisando...',
    },
    settings: {
      title: 'Configurações',
      language: 'Idioma da interface',
      selectLanguage: 'Selecionar idioma',
      updates: 'Atualizações',
      checkUpdates: 'Verificar atualizações',
      currentVersion: 'Versão atual',
      upToDate: 'O aplicativo está atualizado',
    },
  },
  zh: {
    common: {
      search: '搜索',
      close: '关闭',
      save: '保存',
      cancel: '取消',
      delete: '删除',
      edit: '编辑',
      add: '添加',
      copy: '复制',
      copied: '已复制！',
      loading: '加载中...',
      error: '错误',
      success: '成功',
    },
    passwords: {
      title: '密码',
      addPassword: '添加密码',
      editPassword: '编辑密码',
      deletePassword: '删除密码',
      confirmDelete: '您确定要删除此密码吗？',
      noPasswords: '未找到密码',
      searchPlaceholder: '搜索密码...',
      service: '服务',
      login: '登录',
      password: '密码',
      url: 'URL',
      notes: '备注',
      showPassword: '显示密码',
      hidePassword: '隐藏密码',
      copyPassword: '复制密码',
      copyLogin: '复制登录',
      copyUrl: '复制URL',
      favorites: '收藏',
      all: '全部',
    },
    overlay: {
      searchPlaceholder: '搜索密码...',
      noResults: '未找到密码',
      searching: '搜索中...',
    },
    settings: {
      title: '设置',
      language: '界面语言',
      selectLanguage: '选择语言',
      updates: '更新',
      checkUpdates: '检查更新',
      currentVersion: '当前版本',
      upToDate: '应用程序已是最新版本',
    },
  },
  ja: {
    common: {
      search: '検索',
      close: '閉じる',
      save: '保存',
      cancel: 'キャンセル',
      delete: '削除',
      edit: '編集',
      add: '追加',
      copy: 'コピー',
      copied: 'コピーしました！',
      loading: '読み込み中...',
      error: 'エラー',
      success: '成功',
    },
    passwords: {
      title: 'パスワード',
      addPassword: 'パスワードを追加',
      editPassword: 'パスワードを編集',
      deletePassword: 'パスワードを削除',
      confirmDelete: 'このパスワードを削除してもよろしいですか？',
      noPasswords: 'パスワードが見つかりません',
      searchPlaceholder: 'パスワードを検索...',
      service: 'サービス',
      login: 'ログイン',
      password: 'パスワード',
      url: 'URL',
      notes: 'メモ',
      showPassword: 'パスワードを表示',
      hidePassword: 'パスワードを非表示',
      copyPassword: 'パスワードをコピー',
      copyLogin: 'ログインをコピー',
      copyUrl: 'URLをコピー',
      favorites: 'お気に入り',
      all: 'すべて',
    },
    overlay: {
      searchPlaceholder: 'パスワードを検索...',
      noResults: 'パスワードが見つかりません',
      searching: '検索中...',
    },
    settings: {
      title: '設定',
      language: 'インターフェース言語',
      selectLanguage: '言語を選択',
      updates: '更新',
      checkUpdates: '更新を確認',
      currentVersion: '現在のバージョン',
      upToDate: 'アプリケーションは最新です',
    },
  },
  ko: {
    common: {
      search: '검색',
      close: '닫기',
      save: '저장',
      cancel: '취소',
      delete: '삭제',
      edit: '편집',
      add: '추가',
      copy: '복사',
      copied: '복사됨!',
      loading: '로딩 중...',
      error: '오류',
      success: '성공',
    },
    passwords: {
      title: '비밀번호',
      addPassword: '비밀번호 추가',
      editPassword: '비밀번호 편집',
      deletePassword: '비밀번호 삭제',
      confirmDelete: '이 비밀번호를 삭제하시겠습니까?',
      noPasswords: '비밀번호를 찾을 수 없습니다',
      searchPlaceholder: '비밀번호 검색...',
      service: '서비스',
      login: '로그인',
      password: '비밀번호',
      url: 'URL',
      notes: '메모',
      showPassword: '비밀번호 표시',
      hidePassword: '비밀번호 숨기기',
      copyPassword: '비밀번호 복사',
      copyLogin: '로그인 복사',
      copyUrl: 'URL 복사',
      favorites: '즐겨찾기',
      all: '전체',
    },
    overlay: {
      searchPlaceholder: '비밀번호 검색...',
      noResults: '비밀번호를 찾을 수 없습니다',
      searching: '검색 중...',
    },
    settings: {
      title: '설정',
      language: '인터페이스 언어',
      selectLanguage: '언어 선택',
      updates: '업데이트',
      checkUpdates: '업데이트 확인',
      currentVersion: '현재 버전',
      upToDate: '애플리케이션이 최신 상태입니다',
    },
  },
};

export function getTranslation(lang: string): Translations {
  return translations[lang] || translations['en'];
}
