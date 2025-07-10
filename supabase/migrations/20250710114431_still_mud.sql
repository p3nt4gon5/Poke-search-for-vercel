/*
  # Email Notifications System

  1. New Fields
    - Add email_notifications field to profiles table

  2. New Tables
    - email_notifications_log for tracking sent emails

  3. Security
    - Enable RLS on email_notifications_log
    - Add admin-only policies for email logs

  4. Functions and Triggers
    - Function to notify users about new pokemon
    - Trigger to automatically send notifications
    - Test function for manual notifications
*/

-- Добавляем поле email_notifications в таблицу profiles если его нет
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email_notifications'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email_notifications boolean DEFAULT true;
  END IF;
END $$;

-- Создаем таблицу для логирования email уведомлений если её нет
CREATE TABLE IF NOT EXISTS email_notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  pokemon_id integer NOT NULL,
  pokemon_name text NOT NULL,
  email_sent_at timestamptz DEFAULT now(),
  email_status text DEFAULT 'sent',
  message_id text,
  created_at timestamptz DEFAULT now()
);

-- Включаем RLS для таблицы логов
ALTER TABLE email_notifications_log ENABLE ROW LEVEL SECURITY;

-- Удаляем существующие политики если они есть
DROP POLICY IF EXISTS "Админы могут читать логи уведомле" ON email_notifications_log;
DROP POLICY IF EXISTS "Админы могут читать логи уведомлений" ON email_notifications_log;

-- Создаем политику для чтения логов админами
CREATE POLICY "Админы могут читать логи уведомлений"
  ON email_notifications_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Создаем индексы для таблицы логов
CREATE INDEX IF NOT EXISTS email_notifications_log_user_id_idx ON email_notifications_log(user_id);
CREATE INDEX IF NOT EXISTS email_notifications_log_pokemon_id_idx ON email_notifications_log(pokemon_id);
CREATE INDEX IF NOT EXISTS email_notifications_log_sent_at_idx ON email_notifications_log(email_sent_at);

-- Функция для отправки уведомлений о новых покемонах
CREATE OR REPLACE FUNCTION notify_users_about_new_pokemon()
RETURNS TRIGGER AS $$
DECLARE
  pokemon_data jsonb;
BEGIN
  -- Проверяем, что это новый покемон (INSERT) или покемон стал активным
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.is_active = false AND NEW.is_active = true) THEN
    
    -- Формируем данные покемона для отправки
    pokemon_data := jsonb_build_object(
      'id', NEW.id,
      'name', NEW.name,
      'sprites', NEW.sprites
    );
    
    -- Вызываем Edge Function для отправки email уведомлений
    -- Используем pg_net для HTTP запроса (если доступно)
    BEGIN
      PERFORM
        net.http_post(
          url := current_setting('app.supabase_url') || '/functions/v1/send-pokemon-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
          ),
          body := jsonb_build_object('pokemon', pokemon_data)
        );
    EXCEPTION
      WHEN OTHERS THEN
        -- Если pg_net недоступен, логируем ошибку но не прерываем операцию
        RAISE NOTICE 'Failed to send notification for pokemon %: %', NEW.name, SQLERRM;
    END;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер для автоматической отправки уведомлений
DROP TRIGGER IF EXISTS notify_new_pokemon_trigger ON external_pokemon;
CREATE TRIGGER notify_new_pokemon_trigger
  AFTER INSERT OR UPDATE ON external_pokemon
  FOR EACH ROW
  EXECUTE FUNCTION notify_users_about_new_pokemon();

-- Функция для ручной отправки уведомления (для тестирования)
CREATE OR REPLACE FUNCTION send_test_notification(pokemon_id integer)
RETURNS void AS $$
DECLARE
  pokemon_record external_pokemon%ROWTYPE;
  pokemon_data jsonb;
BEGIN
  -- Получаем данные покемона
  SELECT * INTO pokemon_record FROM external_pokemon WHERE id = pokemon_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pokemon with id % not found', pokemon_id;
  END IF;
  
  -- Формируем данные для отправки
  pokemon_data := jsonb_build_object(
    'id', pokemon_record.id,
    'name', pokemon_record.name,
    'sprites', pokemon_record.sprites
  );
  
  -- Отправляем уведомление
  PERFORM
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-pokemon-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := jsonb_build_object('pokemon', pokemon_data)
    );
    
  RAISE NOTICE 'Test notification sent for pokemon: %', pokemon_record.name;
END;
$$ LANGUAGE plpgsql;