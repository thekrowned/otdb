CREATE OR REPLACE FUNCTION public.new_mappool(
	v_title text,
	n_submitted_by integer,
    r_slots varchar(8)[],
	r_mpbm database_mappoolbeatmap[],
	r_bm_md database_beatmapmetadata[],
	r_bms_md database_beatmapsetmetadata[],
	r_bm_mods database_beatmapmod[][],
	n_existing_id integer)
    RETURNS integer
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
AS $BODY$
DECLARE 
	n_i int := 1;
	n_mod_i int := 1;
	n_mp_id int := n_existing_id;
	n_mb_id int;
	n_avg_sr float := 0.0;
    r_tmp_mpbm record;
    b_mpbm_exists boolean;
    r_tmp_bm_mod record;
    b_mod_matches boolean;
    n_mod_id int;

BEGIN

FOR n_i IN 1 .. array_length(r_mpbm, 1) LOOP
	n_avg_sr := n_avg_sr + r_mpbm[n_i].star_rating;
END LOOP;
n_avg_sr := n_avg_sr / array_length(r_mpbm, 1);
n_i := 1;

-- If not editing a mappool
IF n_existing_id = 0 THEN
	INSERT INTO database_mappool (
		name, 
		submitted_by_id,
		avg_star_rating
	) VALUES (
		v_title,
		n_submitted_by,
		n_avg_sr
	) RETURNING id INTO n_mp_id;
ELSE
	UPDATE database_mappool SET
		name = v_title,
		submitted_by_id = n_submitted_by,
		avg_star_rating = n_avg_sr
	WHERE id = n_existing_id;
    -- Easier to delete all connections and recreate new ones
	DELETE FROM database_mappoolbeatmapconnection WHERE mappool_id = n_existing_id;
END IF;

FOR n_i IN 1 .. array_length(r_mpbm, 1) LOOP
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
		r_bm_md[n_i].id,
		r_bm_md[n_i].difficulty,
		r_bm_md[n_i].ar,
		r_bm_md[n_i].od,
		r_bm_md[n_i].cs,
		r_bm_md[n_i].hp,
		r_bm_md[n_i].length,
		r_bm_md[n_i].bpm
	) ON CONFLICT (id) DO UPDATE
		SET difficulty = r_bm_md[n_i].difficulty,
			ar = r_bm_md[n_i].ar,
			od = r_bm_md[n_i].od,
			cs = r_bm_md[n_i].cs,
			hp = r_bm_md[n_i].hp,
			length = r_bm_md[n_i].length,
			bpm = r_bm_md[n_i].bpm;
	
	INSERT INTO database_beatmapsetmetadata (
		id,
		artist,
		title,
		creator
	) VALUES (
		r_bms_md[n_i].id,
		r_bms_md[n_i].artist,
		r_bms_md[n_i].title,
		r_bms_md[n_i].creator
	) ON CONFLICT (id) DO UPDATE
		SET artist = r_bms_md[n_i].artist,
			title = r_bms_md[n_i].title,
			creator = r_bms_md[n_i].creator;

	-- Check if this mappoolbeatmap already exists in the db (with same mods)

	b_mpbm_exists := false;

	FOR r_tmp_mpbm IN SELECT * FROM database_mappoolbeatmap WHERE beatmap_metadata_id = r_bm_md[n_i].id LOOP
	    b_mpbm_exists := true;

	    -- If both mappoolbeatmaps have no mods
	    IF array_length(r_bm_mods, 2) == 0 AND (SELECT COUNT(*) FROM database_mappoolbeatmap_mods WHERE mappoolbeatmap_id = r_tmp_mpbm.id) = 0 THEN
	        b_mpbm_exists := true;
	    ELSE
	        -- Check that mods on both mappoolbeatmap rows match
            FOR r_tmp_bm_mod IN (
                SELECT acronym, settings FROM database_mappoolbeatmap_mods
                INNER JOIN database_beatmapmod ON (database_beatmapmod.id = database_mappoolbeatmap_mods.beatmapmod_id)
                WHERE mappoolbeatmap_id = r_tmp_mpbm.id
            ) LOOP
                b_mod_matches := false;

                FOR n_mod_i IN 1 .. array_length(r_bm_mods, 2) LOOP
                    IF r_bm_mods[n_i][n_mod_i].acronym = r_tmp_bm_mod.acronym AND r_bm_mods[n_i][n_mod_i].settings = r_tmp_bm_mod.settings THEN
                        b_mod_matches := true;
                        EXIT;
                    END IF;
                END LOOP;

                n_mod_i := 1;

                IF NOT b_mod_matches THEN
                    b_mpbm_exists := false;
                    EXIT;
                END IF;
            END LOOP;
        END IF;

	    IF b_mpbm_exists = true THEN
            EXIT;
        END IF;
    END LOOP;

	IF NOT b_mpbm_exists THEN
        INSERT INTO database_mappoolbeatmap (
            star_rating,
            beatmap_metadata_id,
            beatmapset_metadata_id
        ) VALUES (
            r_mpbm[n_i].star_rating,
            r_bm_md[n_i].id,
            r_bms_md[n_i].id
        ) RETURNING id INTO n_mb_id;
    -- TODO: update existing row if exists
    END IF;
	
	INSERT INTO database_mappoolbeatmapconnection (
		mappool_id,
		beatmap_id,
	    slot
	) VALUES (
		n_mp_id,
		n_mb_id,
	    r_slots[n_i]
	);

	-- Insert mods
	IF array_length(r_bm_mods, 2) > 0 THEN
        FOR n_mod_i IN 1 .. array_length(r_bm_mods, 2) LOOP
            IF r_bm_mods[n_i][n_mod_i].acronym IS NULL THEN
                CONTINUE;
            END IF;

            INSERT INTO database_beatmapmod (
                acronym,
                settings
            ) VALUES (
                r_bm_mods[n_i][n_mod_i].acronym,
                r_bm_mods[n_i][n_mod_i].settings
            )
            ON CONFLICT (acronym, settings) DO UPDATE
                SET acronym = excluded.acronym  -- do something so id is returned
            RETURNING id INTO n_mod_id;

            INSERT INTO database_mappoolbeatmap_mods (
                mappoolbeatmap_id,
                beatmapmod_id
            ) VALUES (
                n_mb_id,
                n_mod_id
            ) ON CONFLICT (mappoolbeatmap_id, beatmapmod_id) DO NOTHING;
        END LOOP;
    END IF;
	
	n_i := n_i + 1;
	n_mod_i := 1;
END LOOP;

RETURN n_mp_id;

END;
$BODY$;
