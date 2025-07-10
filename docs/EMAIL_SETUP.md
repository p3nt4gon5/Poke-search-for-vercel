# Email Notifications Setup Guide

Это руководство поможет вам настроить систему email уведомлений для новых покемонов в вашем приложении.

## Обзор системы

Система автоматически отправляет email уведомления всем зарегистрированным пользователям при добавлении нового покемона в базу данных. Уведомления включают:

- Название и изображение покемона
- Кликабельную ссылку на страницу покемона
- Красивый HTML дизайн
- Возможность отписки от уведомлений

## Настройка SendGrid

### 1. Создание аккаунта SendGrid

1. Перейдите на [sendgrid.com](https://sendgrid.com)
2. Создайте бесплатный аккаунт (100 писем в день бесплатно)
3. Подтвердите email адрес

### 2. Получение API ключа

1. В панели SendGrid перейдите в **Settings** → **API Keys**
2. Нажмите **Create API Key**
3. Выберите **Full Access** или настройте ограниченные права
4. Скопируйте API ключ (он показывается только один раз!)

### 3. Настройка домена отправителя

1. Перейдите в **Settings** → **Sender Authentication**
2. Выберите **Single Sender Verification** для быстрой настройки
3. Или настройте **Domain Authentication** для профессионального вида

## Настройка Supabase

### 1. Переменные окружения

В панели Supabase перейдите в **Settings** → **Edge Functions** и добавьте переменные:

```bash
SENDGRID_API_KEY=your_sendgrid_api_key_here
FROM_EMAIL=noreply@yourdomain.com
SITE_URL=https://yourdomain.com
```

### 2. Включение pg_net расширения

1. Перейдите в **Database** → **Extensions**
2. Найдите и включите расширение `pg_net`
3. Это необходимо для HTTP запросов из триггеров базы данных

### 3. Настройка конфигурации

В **Settings** → **Database** → **Configuration** добавьте:

```sql
-- Настройки для Edge Functions
ALTER DATABASE postgres SET "app.supabase_url" = 'https://your-project.supabase.co';
ALTER DATABASE postgres SET "app.supabase_service_role_key" = 'your_service_role_key';
```

## Развертывание Edge Function

### 1. Установка Supabase CLI

```bash
npm install -g supabase
```

### 2. Логин и связывание проекта

```bash
supabase login
supabase link --project-ref your-project-ref
```

### 3. Развертывание функции

```bash
supabase functions deploy send-pokemon-notification
```

## Применение миграций

Выполните миграцию для создания необходимых таблиц и триггеров:

```bash
supabase db push
```

Или примените миграцию вручную в SQL Editor:

```sql
-- Содержимое файла 20250104000000_email_notifications_system.sql
```

## Тестирование системы

### 1. Через админ-панель

1. Войдите как администратор
2. Перейдите в **Email Notifications Manager**
3. Введите ID существующего покемона
4. Нажмите **Send Test**

### 2. Через SQL

```sql
-- Отправить тестовое уведомление для покемона с ID 25 (Pikachu)
SELECT send_test_notification(25);
```

### 3. Добавление нового покемона

Просто добавьте нового покемона через админ-панель - уведомления отправятся автоматически.

## Управление подписками

### Пользователи могут:

1. Включить/выключить уведомления в профиле
2. Изменить настройки через ссылку в письме
3. Полностью отписаться от уведомлений

### Администраторы могут:

1. Просматривать статистику отправленных писем
2. Отправлять тестовые уведомления
3. Мониторить успешность доставки

## Альтернативные провайдеры email

### Resend

```typescript
// Замените SendGrid API на Resend
const response = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: 'noreply@yourdomain.com',
    to: [profile.email],
    subject: `🎉 New Pokemon Added: ${pokemonName}!`,
    html: emailHTML,
  }),
});
```

### Mailgun

```typescript
// Для Mailgun
const formData = new FormData();
formData.append('from', FROM_EMAIL);
formData.append('to', profile.email);
formData.append('subject', `🎉 New Pokemon Added: ${pokemonName}!`);
formData.append('html', emailHTML);

const response = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`,
  },
  body: formData,
});
```

## Мониторинг и отладка

### Логи Edge Function

```bash
supabase functions logs send-pokemon-notification
```

### Проверка статуса доставки

Все отправленные письма логируются в таблице `email_notifications_log`:

```sql
SELECT 
  pokemon_name,
  email_status,
  email_sent_at,
  COUNT(*) as count
FROM email_notifications_log 
GROUP BY pokemon_name, email_status, email_sent_at
ORDER BY email_sent_at DESC;
```

### Частые проблемы

1. **"schema net does not exist"** - Включите расширение `pg_net`
2. **"Unauthorized"** - Проверьте API ключи в переменных окружения
3. **"Function not found"** - Убедитесь, что Edge Function развернута
4. **Письма не доходят** - Проверьте spam папку и настройки домена

## Производительность

### Для большого количества пользователей

1. Используйте очереди (например, через Supabase Realtime)
2. Отправляйте письма батчами
3. Добавьте rate limiting
4. Рассмотрите использование background jobs

### Пример с очередью

```sql
-- Создание таблицы очереди
CREATE TABLE email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pokemon_id integer NOT NULL,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

-- Триггер добавляет задачу в очередь вместо прямой отправки
CREATE OR REPLACE FUNCTION queue_pokemon_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO email_queue (pokemon_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Безопасность

1. **Никогда не храните API ключи в коде**
2. **Используйте переменные окружения**
3. **Ограничьте права API ключей**
4. **Мониторьте использование API**
5. **Добавьте rate limiting для предотвращения спама**

## Заключение

После настройки система будет автоматически отправлять красивые email уведомления всем пользователям при добавлении новых покемонов. Пользователи смогут управлять своими подписками, а администраторы - мониторить работу системы.