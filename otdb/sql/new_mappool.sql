CREATE OR REPLACE FUNCTION public.new_mappool(
	text,
	integer,
	database_mappoolbeatmap[],
	database_beatmapmetadata[],
	database_beatmapsetmetadata[],
	database_beatmapmod[],
	integer)
    RETURNS integer
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
AS $BODY$
DECLARE 
	i int := 1;
	mod_i int := 1;
	mp_id int := $7;
	mb_id int;
	avg_sr float := 0.0;

BEGIN

WHILE i <= array_length($3, 1) LOOP
	avg_sr := avg_sr + $3[i].star_rating;
	i := i + 1;
END LOOP;
avg_sr := avg_sr / array_length($3, 1);
i := 1;

IF $7 = 0 THEN
	INSERT INTO database_mappool (
		name, 
		submitted_by_id,
		avg_star_rating
	) VALUES (
		$1,
		$2,
		avg_sr
	) RETURNING id INTO mp_id;
ELSE
	UPDATE database_mappool SET
		name = $1,
		submitted_by_id = $2,
		avg_star_rating = avg_sr
	WHERE id = $7;
	DELETE FROM database_mappoolbeatmap_mods 
	WHERE database_mappoolbeatmap_mods.mappoolbeatmap_id in (
		SELECT database_mappoolbeatmap.id FROM database_mappool_beatmaps 
		INNER JOIN database_mappoolbeatmap ON (database_mappoolbeatmap.id = mappoolbeatmap_id) 
		WHERE mappool_id = $7
	);
	DELETE FROM database_mappoolbeatmap 
	WHERE database_mappoolbeatmap.id in (
		SELECT database_mappoolbeatmap.id FROM database_mappool_beatmaps 
		INNER JOIN database_mappoolbeatmap ON (database_mappoolbeatmap.id = mappoolbeatmap_id) 
		WHERE mappool_id = $7
	);
	DELETE FROM database_mappool_beatmaps WHERE mappool_id = $7;
END IF;

WHILE i <= array_length($3, 1) LOOP
	INSERT INTO database_beatmapmetadata (
		id, 
		difficulty, 
		ar, 
		od, 
		cs, 
		hp, 
		length,
		bpm
	) VALUES (
		$4[i].id, 
		$4[i].difficulty, 
		$4[i].ar, 
		$4[i].od, 
		$4[i].cs, 
		$4[i].hp,
		$4[i].length,
		$4[i].bpm
	) ON CONFLICT (id) DO UPDATE
		SET difficulty = $4[i].difficulty,
			ar = $4[i].ar,
			od = $4[i].od,
			cs = $4[i].cs,
			hp = $4[i].hp,
			length = $4[i].length,
			bpm = $4[i].bpm;
	
	INSERT INTO database_beatmapsetmetadata (
		id,
		artist,
		title,
		creator
	) VALUES (
		$5[i].id,
		$5[i].artist,
		$5[i].title,
		$5[i].creator
	) ON CONFLICT (id) DO UPDATE
		SET artist = $5[i].artist,
			title = $5[i].title,
			creator = $5[i].creator;
	
	INSERT INTO database_mappoolbeatmap (
		slot,
		star_rating,
		beatmap_metadata_id,
		beatmapset_metadata_id
	) VALUES (
		$3[i].slot,
		$3[i].star_rating,
		$4[i].id,
		$5[i].id
	) RETURNING id INTO mb_id;
	
	INSERT INTO database_mappool_beatmaps (
		mappool_id,
		mappoolbeatmap_id
	) VALUES (
		mp_id,
		mb_id
	);
	
	WHILE mod_i <= array_length($6, 1) LOOP
		IF $6[i][mod_i].acronym IS NULL THEN
			mod_i := mod_i + 1;
			CONTINUE;
		END IF;
		WITH mod_id AS (
			INSERT INTO database_beatmapmod (
				acronym,
				settings
			) VALUES (
				$6[i][mod_i].acronym,
				$6[i][mod_i].settings
			)
			ON CONFLICT DO NOTHING
			RETURNING id
		)
		INSERT INTO database_mappoolbeatmap_mods (
			mappoolbeatmap_id,
			beatmapmod_id
		) VALUES (
			mb_id,
			(SELECT id FROM mod_id)
		);
		
		mod_i := mod_i + 1;
	END LOOP;
	
	i := i + 1;
	mod_i := 1;
END LOOP;

RETURN mp_id;

END;
$BODY$;
