import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
}

/**
 * SEO component that ensures all meta tags are present on every page.
 * Provides defaults that match the base SEO tags from Django template.
 * Individual pages can override specific tags by passing props.
 */
export default function SEO({
  title,
  description = "Play Boggle online free. Play Boojum - a fun, free multiplayer word game inspired by Boggle and Scrabble. Live games, leaderboards, daily boards and Mini-Games. Test your vocab, draw, chat and join our weekly Tournaments! For mobile, tablet, or desktop.",
  keywords = "online boggle word game, multiplayer boggle, word puzzle game, play boggle online, online boggle, Free word games, boggle game, free boggle game, online word games, live boggle, boggle live, adult word game, free online word game, mobile word games, free mobile boggle game, play online boggle, play word game online, play boggle live game, live word games, multiplayer word games, multiplayer boggle, free educational word game, games with friends, words with friends, free game friends, free educational game for kids, fun word games, fun online game, fun free games, games like boggle, games like serpentine, games like wordshake, play with friends, play with friends online, play with friends online free, game profile, profile page, phone games, free phone word game, free phone boggle, free scrabble game, scrabble phone, games like scrabble, anagram games, games like countdown, games like lexicon, scrabble mobile, scrabble free, competitive online game, competitive word game, social online games, puzzle words, games like puzzle words, games like wordle, group word game, learning English games, play and learn English, online games for children, free online games for children, how to play, how to play boggle, boggle rules, game rooms, bonus words, game tournaments, boggle scoring, boojum game, boojum, boojum tree, boogum, dictionary games, word definition Boojum boggle, boojum word, boojum Game, boojum word game, boojum free game, boojum profile page, create your profile, make your profile, boojum sign up, boojum sign in, boojum scrabble, play boojum, play boojum Boggle, free boojum word game, free boojum boggle, boojum boggle online, live boggle boojum, boojum mobile, boojum iPad, boojum tablet, boojum phone, boojum dictionary, boojum word list, how to play boojum, boojum rules, boojum scoring, boojum scoreboard, boojum leaderboard, boojum Game room, boojum new game, who made boojum, what is boojum, boojum definition, boojum defined, define boojum, what does boojum mean, boojum colour, boojum color",
  ogTitle = "Boojum",
  ogDescription,
  ogImage = "https://www.boojumgames.com/images/share_img.png",
  ogUrl,
  twitterTitle = "Boojum Games",
  twitterDescription,
  twitterImage = "https://www.boojumgames.com/images/share_img.png",
}: SEOProps) {
  const location = useLocation();
  
  // Use description prop for og:description and twitter:description if not separately provided
  const finalOgDescription = ogDescription || description;
  const finalTwitterDescription = twitterDescription || description;
  const finalTitle = title ? `${title} | Boojum` : "Boojum, Play Boggle Online Free";
  
  // Generate dynamic og:url if not provided
  const finalOgUrl = ogUrl || `https://www.boojumgames.com${location.pathname}${location.search}`;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <title>{finalTitle}</title>

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={finalOgUrl} />
      <meta property="og:title" content={ogTitle} />
      <meta property="og:description" content={finalOgDescription} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={twitterTitle} />
      <meta name="twitter:description" content={finalTwitterDescription} />
      <meta name="twitter:image" content={twitterImage} />
    </Helmet>
  );
}
