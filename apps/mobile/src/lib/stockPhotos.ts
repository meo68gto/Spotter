export const stockPhotos = {
  dashboardHeroGolf:
    'https://images.pexels.com/photos/114972/pexels-photo-114972.jpeg?auto=compress&cs=tinysrgb&w=1200',
  dashboardHeroPickleball:
    'https://images.pexels.com/photos/8224736/pexels-photo-8224736.jpeg?auto=compress&cs=tinysrgb&w=1200',
  dashboardHeroProgress:
    'https://images.pexels.com/photos/414029/pexels-photo-414029.jpeg?auto=compress&cs=tinysrgb&w=1200',
  homeHero:
    'https://images.pexels.com/photos/209977/pexels-photo-209977.jpeg?auto=compress&cs=tinysrgb&w=1400',
  discoverHero:
    'https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg?auto=compress&cs=tinysrgb&w=1400',
  networkHero:
    'https://images.pexels.com/photos/3652352/pexels-photo-3652352.jpeg?auto=compress&cs=tinysrgb&w=1400',
  eventsHero:
    'https://images.pexels.com/photos/976866/pexels-photo-976866.jpeg?auto=compress&cs=tinysrgb&w=1400',
  coachBrowseHero:
    'https://images.pexels.com/photos/416778/pexels-photo-416778.jpeg?auto=compress&cs=tinysrgb&w=1400',
  coachProfileHero:
    'https://images.pexels.com/photos/1552106/pexels-photo-1552106.jpeg?auto=compress&cs=tinysrgb&w=1400'
} as const;

export type StockPhotoKey = keyof typeof stockPhotos;
