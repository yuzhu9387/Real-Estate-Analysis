-- Public-owner classification for Santa Clara County ATTOM taxassessor
-- Filter: lot >= 6000 sqft, target cities
\set ON_ERROR_STOP on

drop table if exists tmp_public_parcels;
create temp table tmp_public_parcels as
with base as (
  select *
  from public.taxassessor
  where arealotsf >= 6000
    and upper(propertyaddresscity) in
        ('PALO ALTO','MOUNTAIN VIEW','SUNNYVALE','CUPERTINO','CAMPBELL','SANTA CLARA','SAN JOSE')
    and partyowner1namefull is not null
),
cls as (
  select b.*,
    upper(partyowner1namefull) o,
    case
      -- 1 Federal
      when (upper(partyowner1namefull) ~ '(\mUNITED STATES\M|POSTAL SERVICE|POST SERVICE|POSTAL SVC|GENERAL SERVICES ADMIN|VETERANS ADMIN|\mGSA\M|\mDEPARTMENT OF THE\M|NATIONAL PARK|\mNASA\M)'
             or upper(partyowner1namefull) ~ '^U ?S ?A$')
           and upper(partyowner1namefull) !~ '(STORAGE|DEPOT|CHEVRON|VENTURES|\mINC\M|\mLLC\M|\mCORP\M|\mCO\M|CHURCH|PRESBYT|SOCIETY|RELIEF|GOLFLAND|PACKAGING|\mTECH\M)'
        then '1 Federal'
      -- 4 School / public education (districts, community colleges, UC regents) -- checked before municipal/county so "X UNIFIED S D" wins
      when upper(partyowner1namefull) ~ '(SCHOOL DIST|\mUNIFIED\M|\mS D\M|COMMUNITY COLLEGE|CMNTY COLLEGE|COLLEGE DIST|BOARD OF EDUCATION|REGENTS OF UNIV|\mUNION SCHOOL\M|ELEMENTARY SCHOOL|HIGH SCHOOL DIST|JOINT UNION|FOOTHILL COLLEGE|SAN JOSE STATE UNIV)'
           and upper(partyowner1namefull) !~ '(\mTRUST\M|PROPERTIES|ASSOCS|\mLLC\M|\mINC\M|DOLLINGER)'
        then '4 School / Public Ed'
      -- 2 Santa Clara County + county special districts (Valley Water, VTA, Open Space, Habitat)
      when upper(partyowner1namefull) ~ '(SANTA CLARA COUNTY|COUNTY OF SANTA CLARA|\mVALLEY WATER\M|SANTA CLARA VALLEY WATER|TRANSIT DIST|TRANS AUTHORITY|\mVTA\M|OPEN SPACE AUTH|HABITAT AGENCY|VECTOR CONT|CTRL FIRE|CORRECTION)'
           and upper(partyowner1namefull) !~ '(CALIFORNIA PIONEERS|GOODWILL|\mASSN\M|ASSOCIAT|\mSOCIETY\M|\mSOCI\M|CHURCH|TITLE CO|\mEXCHANGE\M|HORSEMEN|PLANNED PARENTHOOD|DENTAL|MEDICAL ASSOC|\mLP\M|\mINC\M|FAIRGROUNDS SR HOUSING)'
        then '2 Santa Clara County'
      -- 3 Municipal (cities) -- both "CITY OF X" and "X CITY", plus SF City&County (SFPUC), redevelopment, housing authority
      when (upper(partyowner1namefull) !~ '(CITY CENTER|CITY CTR|PACIFIC GAS|PG&E|\mIN CITY OF\M)'
        and partyowner1namefull !~ '^[0-9]'
        and (
          (upper(partyowner1namefull) ~ '\mCITY OF\M'
             and upper(partyowner1namefull) !~ '(\mLLC\M|\mINC\M|COMPANY|\mCO\M|DEVELOPMENT CO|\mGROUP\M|REALTY|CITYVIEW)')
        or upper(partyowner1namefull) ~ '\m(SAN JOSE|SANTA CLARA|SUNNYVALE|MT VIEW|MOUNTAIN VIEW|PALO ALTO|CUPERTINO|CAMPBELL|LOS GATOS|MILPITAS|SARATOGA|LOS ALTOS|MORGAN HILL|GILROY|MONTE SERENO|SAN FRANCISCO) CITY\M'
        or upper(partyowner1namefull) ~ '\mSFPUC\M'
        or upper(partyowner1namefull) ~ '(REDEVELOPMENT AGENC|REDEV AGENCY|\mHOUSING AUTHORITY\M)'
        ))
        then '3 Municipal'
      -- 5 State of California (bonus, outside the 4 asked categories)
      when upper(partyowner1namefull) ~ '(STATE OF CALIF|CALIFORNIA STATE|\mSTATE CALIFORNIA\M|\mCALTRANS\M|STATE OF CA\M)'
        then '5 State of California'
      else null
    end owner_category
  from base b
)
select * from cls where owner_category is not null;
