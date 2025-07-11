# Тестирование системы email уведомлений

## Пошаговая проверка работы системы

### 1. Проверка применения миграции

Сначала убедитесь, что миграция применилась успешно:

```bash
# В терминале Supabase
supabase db push
```

Или проверьте в SQL Editor Supabase:
```sql
-- Проверяем, что таблица создана
SELECT * FROM email_notifications_log LIMIT 1;

-- Проверяем, что функции созданы
SELECT proname FROM pg_proc WHERE proname IN ('notify_users_about_new_pokemon', 'send_test_notification');

-- Проверяем, что триггер создан
SELECT tgname FROM pg_trigger WHERE tgname = 'notify_new_pokemon_trigger';
```

### 2. Настройка переменных окружения

В Supabase Dashboard → Settings → Edge Functions добавьте:

```
SENDGRID_API_KEY=your_sendgrid_api_key_here
FROM_EMAIL=noreply@yourdomain.com
SITE_URL=https://yourdomain.com
```

### 3. Развертывание Edge Function

```bash
# Разверните функцию отправки уведомлений
supabase functions deploy send-pokemon-notification
```

### 4. Проверка настроек базы данных

В SQL Editor выполните:

```sql
-- Настройте URL и ключи для функций
ALTER DATABASE postgres SET "app.supabase_url" = 'https://your-project.supabase.co';
ALTER DATABASE postgres SET "app.supabase_service_role_key" = 'your_service_role_key';

-- Включите расширение pg_net (если еще не включено)
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 5. Тест 1: Проверка через SQL

```sql
-- Отправить тестовое уведомление для существующего покемона
SELECT send_test_notification(25); -- Pikachu

-- Проверить логи
SELECT * FROM email_notifications_log ORDER BY created_at DESC LIMIT 5;
```

### 6. Тест 2: Через админ-панель

1. Войдите как администратор на сайт
2. Перейдите в профиль → Admin Panel
3. Найдите раздел "Email Notifications Manager"
4. Введите ID существующего покемона (например, 25)
5. Нажмите "Send Test"

### 7. Тест 3: Добавление нового покемона

```sql
-- Добавить тестового покемона
INSERT INTO external_pokemon (
  id, name, height, weight, types, abilities, stats, sprites, is_active, is_hidden
) VALUES (
  9999,
  'testmon',
  10,
  100,
  '[{"type": {"name": "electric"}}]'::jsonb,
  '[{"ability": {"name": "static"}}]'::jsonb,
  '[{"base_stat": 50, "stat": {"name": "hp"}}]'::jsonb,
  '{"front_default": "https://example.com/image.png", "other": {"official-artwork": {"front_default": "https://example.com/artwork.png"}}}'::jsonb,
  true,
  false
);

-- Проверить, что уведомление отправилось
SELECT * FROM email_notifications_log WHERE pokemon_id = 9999;

-- Удалить тестового покемона
DELETE FROM external_pokemon WHERE id = 9999;
```

### 8. Проверка логов Edge Function

```bash
# Посмотреть логи функции
supabase functions logs send-pokemon-notification
```

### 9. Проверка email настроек пользователей

```sql
-- Посмотреть пользователей с включенными уведомлениями
SELECT id, email, full_name, email_notifications 
FROM profiles 
WHERE email_notifications = true 
AND email IS NOT NULL;

-- Включить уведомления для тестового пользователя
UPDATE profiles 
SET email_notifications = true 
WHERE id = 'your-user-id';
```

### 10. Проверка статистики

В админ-панели → Email Notifications Manager вы должны увидеть:
- Количество отправленных писем
- Количество неудачных отправок
- Количество пользователей с подпиской
- Последние уведомления

## Возможные проблемы и решения

### Ошибка "schema net does not exist"
```sql
-- Включите расширение pg_net
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Ошибка "Function not found"
```bash
# Убедитесь, что функция развернута
supabase functions deploy send-pokemon-notification
```

### Письма не приходят
1. Проверьте настройки SendGrid
2. Проверьте spam папку
3. Убедитесь, что FROM_EMAIL подтвержден в SendGrid
4. Проверьте логи функции

### Ошибка авторизации
- Убедитесь, что SUPABASE_SERVICE_ROLE_KEY правильно настроен
- Проверьте права доступа к таблицам

## Мониторинг работы

### Просмотр статистики отправок
```sql
SELECT 
  pokemon_name,
  email_status,
  COUNT(*) as count,
  DATE(email_sent_at) as date
FROM email_notifications_log 
GROUP BY pokemon_name, email_status, DATE(email_sent_at)
ORDER BY date DESC;
```

### Проверка последних уведомлений
```sql
SELECT 
  enl.*,
  p.full_name as user_name
FROM email_notifications_log enl
LEFT JOIN profiles p ON enl.user_id = p.id
ORDER BY enl.created_at DESC
LIMIT 10;
```

### Проверка пользователей без уведомлений
```sql
SELECT COUNT(*) as users_without_notifications
FROM profiles 
WHERE email_notifications = false OR email IS NULL;
```

## Успешный результат

Если все работает правильно, вы должны увидеть:

1. ✅ Миграция применилась без ошибок
2. ✅ Edge Function развернута
3. ✅ При добавлении покемона создается запись в `email_notifications_log`
4. ✅ Пользователи получают email уведомления
5. ✅ В админ-панели отображается статистика
6. ✅ Тестовые уведомления отправляются успешно

## Дополнительные настройки

### Настройка частоты уведомлений
Если нужно ограничить частоту отправки, добавьте в функцию проверку:

```sql
-- Не отправлять уведомления чаще раза в час для одного покемона
CREATE OR REPLACE FUNCTION should_send_notification(p_pokemon_id integer)
RETURNS boolean AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM email_notifications_log 
    WHERE pokemon_id = p_pokemon_id 
    AND email_sent_at > NOW() - INTERVAL '1 hour'
  );
END;
$$ LANGUAGE plpgsql;
```

### Настройка шаблона письма
Отредактируйте функцию `generateEmailHTML` в Edge Function для изменения дизайна письма.