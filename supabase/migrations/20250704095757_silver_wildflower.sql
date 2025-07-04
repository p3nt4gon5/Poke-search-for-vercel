/*
  # Улучшения админ-панели

  1. Изменения в таблице external_pokemon
    - Добавляем поле is_hidden для скрытия покемонов
    - Добавляем поле new_until для тега "Новый"

  2. Обновление политик безопасности
    - Обычные пользователи не видят скрытых покемонов
    - Админы видят все покемоны

  3. Функции для работы с тегами
    - Автоматическое проставление new_until при добавлении
*/

-- Добавляем новые поля в таблицу external_pokemon
DO $$
BEGIN
  -- Добавляем поле is_hidden если его нет
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'external_pokemon' AND column_name = 'is_hidden'
  ) THEN
    ALTER TABLE external_pokemon ADD COLUMN is_hidden boolean DEFAULT false;
  END IF;

  -- Добавляем поле new_until если его нет
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'external_pokemon' AND column_name = 'new_until'
  ) THEN
    ALTER TABLE external_pokemon ADD COLUMN new_until timestamptz DEFAULT (now() + interval '7 days');
  END IF;
END $$;

-- Создаем индексы для новых полей
CREATE INDEX IF NOT EXISTS external_pokemon_hidden_idx ON external_pokemon(is_hidden);
CREATE INDEX IF NOT EXISTS external_pokemon_new_until_idx ON external_pokemon(new_until);

-- Обновляем политики безопасности
DROP POLICY IF EXISTS "Все могут читать активных покемонов" ON external_pokemon;

CREATE POLICY "Обычные пользователи видят активных и не скрытых покемонов"
  ON external_pokemon
  FOR SELECT
  USING (is_active = true AND is_hidden = false);

CREATE POLICY "Админы видят всех покемонов"
  ON external_pokemon
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Функция для автоматического проставления new_until при добавлении
CREATE OR REPLACE FUNCTION set_new_until_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Устанавливаем new_until на 7 дней вперед при создании
  IF NEW.new_until IS NULL THEN
    NEW.new_until = now() + interval '7 days';
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для автоматического проставления new_until
DROP TRIGGER IF EXISTS set_new_until_trigger ON external_pokemon;
CREATE TRIGGER set_new_until_trigger
  BEFORE INSERT ON external_pokemon
  FOR EACH ROW
  EXECUTE FUNCTION set_new_until_on_insert();

-- Функция для проверки, является ли покемон новым
CREATE OR REPLACE FUNCTION is_pokemon_new(pokemon_id integer)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM external_pokemon 
    WHERE id = pokemon_id 
    AND new_until > now()
    AND is_active = true
  );
END;
$$ language 'plpgsql';