import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Pokemon {
  id: number;
  name: string;
  sprites: any;
}

interface Profile {
  id: string;
  email: string;
  full_name: string;
  email_notifications: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Создаем Supabase клиент с service role ключом
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { pokemon } = await req.json();
    
    if (!pokemon) {
      throw new Error("Pokemon data is required");
    }

    console.log("Sending notifications for pokemon:", pokemon.name);

    // Получаем всех пользователей с включенными уведомлениями
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, email_notifications")
      .eq("email_notifications", true)
      .not("email", "is", null);

    if (profilesError) {
      throw new Error(`Error fetching profiles: ${profilesError.message}`);
    }

    if (!profiles || profiles.length === 0) {
      console.log("No users with email notifications enabled");
      return new Response(
        JSON.stringify({ success: true, message: "No users to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${profiles.length} users to notify`);

    // Отправляем email каждому пользователю
    const emailPromises = profiles.map(async (profile: Profile) => {
      try {
        const emailSent = await sendPokemonEmail(pokemon, profile);
        
        // Логируем отправку в базу данных
        await supabaseAdmin.from("email_notifications_log").insert({
          user_id: profile.id,
          pokemon_id: pokemon.id,
          pokemon_name: pokemon.name,
          email_status: emailSent ? "sent" : "failed",
        });

        return { email: profile.email, success: emailSent };
      } catch (error) {
        console.error(`Error sending email to ${profile.email}:`, error);
        
        // Логируем ошибку
        await supabaseAdmin.from("email_notifications_log").insert({
          user_id: profile.id,
          pokemon_id: pokemon.id,
          pokemon_name: pokemon.name,
          email_status: "failed",
        });

        return { email: profile.email, success: false, error: error.message };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    console.log(`Email notifications sent: ${successCount} success, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notifications sent to ${successCount} users`,
        details: { successCount, failureCount, results }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

async function sendPokemonEmail(pokemon: Pokemon, profile: Profile): Promise<boolean> {
  const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
  const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@yoursite.com";
  const SITE_URL = Deno.env.get("SITE_URL") || "https://yoursite.com";

  if (!SENDGRID_API_KEY) {
    throw new Error("SENDGRID_API_KEY environment variable is not set");
  }

  const pokemonImageUrl = pokemon.sprites?.other?.["official-artwork"]?.front_default || 
                         pokemon.sprites?.front_default || 
                         `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.id}.png`;

  const pokemonUrl = `${SITE_URL}/pokemon/${pokemon.name}`;

  const emailData = {
    personalizations: [
      {
        to: [{ email: profile.email, name: profile.full_name || "Pokemon Trainer" }],
        subject: `🎉 New Pokemon Added: ${capitalizeFirst(pokemon.name)}!`,
      },
    ],
    from: { email: FROM_EMAIL, name: "PokéSearch Team" },
    content: [
      {
        type: "text/html",
        value: generateEmailHTML(pokemon, profile, pokemonImageUrl, pokemonUrl),
      },
    ],
  };

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
    }

    console.log(`Email sent successfully to ${profile.email}`);
    return true;
  } catch (error) {
    console.error(`Failed to send email to ${profile.email}:`, error);
    return false;
  }
}

function generateEmailHTML(pokemon: Pokemon, profile: Profile, imageUrl: string, pokemonUrl: string): string {
  const userName = profile.full_name || "Pokemon Trainer";
  const pokemonName = capitalizeFirst(pokemon.name);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Pokemon: ${pokemonName}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background: white;
          border-radius: 12px;
          padding: 30px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .pokemon-image {
          width: 200px;
          height: 200px;
          object-fit: contain;
          border-radius: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
          margin: 20px auto;
          display: block;
        }
        .pokemon-name {
          font-size: 28px;
          font-weight: bold;
          color: #2d3748;
          margin: 20px 0;
          text-transform: capitalize;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-decoration: none;
          padding: 15px 30px;
          border-radius: 8px;
          font-weight: bold;
          font-size: 16px;
          margin: 20px 0;
          transition: transform 0.2s;
        }
        .cta-button:hover {
          transform: translateY(-2px);
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          font-size: 14px;
          color: #718096;
          text-align: center;
        }
        .unsubscribe {
          color: #a0aec0;
          text-decoration: none;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="color: #667eea; margin: 0;">🎉 New Pokemon Discovered!</h1>
          <p style="color: #718096; margin: 10px 0;">Hello ${userName}!</p>
        </div>
        
        <div style="text-align: center;">
          <img src="${imageUrl}" alt="${pokemonName}" class="pokemon-image" />
          <h2 class="pokemon-name">${pokemonName}</h2>
          <p style="color: #4a5568; font-size: 16px; margin: 20px 0;">
            A new Pokemon has been added to our database! 
            Click the button below to learn more about ${pokemonName} and add it to your collection.
          </p>
          
          <a href="${pokemonUrl}" class="cta-button">
            🔍 View ${pokemonName}
          </a>
        </div>
        
        <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2d3748; margin-top: 0;">What you can do:</h3>
          <ul style="color: #4a5568; padding-left: 20px;">
            <li>View detailed stats and abilities</li>
            <li>Add ${pokemonName} to your personal library</li>
            <li>Mark it as a favorite</li>
            <li>Share with other trainers</li>
          </ul>
        </div>
        
        <div class="footer">
          <p>Happy Pokemon hunting! 🎯</p>
          <p style="margin: 10px 0;">
            <strong>The PokéSearch Team</strong>
          </p>
          <p>
            <a href="${pokemonUrl.replace('/pokemon/', '/profile')}" class="unsubscribe">
              Manage email preferences
            </a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}